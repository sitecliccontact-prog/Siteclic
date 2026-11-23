import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parse, type HTMLElement } from "node-html-parser";

export type ImportedSite = {
  url: string;
  title: string;
  description: string;
  pages: { url: string; text: string }[];
  images: string[];
};

export class ImportError extends Error {}

const MAX_BYTES = 2_000_000;
const MAX_TEXT_PER_PAGE = 12_000;
const EXTRA_PAGE_WORDS = /(carte|menu|tarif|prix|prestation|service|produit|horaire|contact|acces|accès|propos|histoire|equipe|équipe|boutique)/i;

/** Vérifie et normalise l'adresse donnée par le client. */
export function normalizeUrl(input: string): URL {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError("Cette adresse ne semble pas valide. Exemple : www.mon-commerce.fr");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
    throw new ImportError("Cette adresse ne semble pas valide. Exemple : www.mon-commerce.fr");
  }
  if (url.port && url.port !== "80" && url.port !== "443") throw new ImportError("Cette adresse n'est pas acceptée.");
  url.hash = "";
  return url;
}

function isPrivateIp(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

/** Refuse les adresses internes (sécurité : on ne va chercher que des sites publics). */
async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || /^(localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new ImportError("Cette adresse n'est pas acceptée.");
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ImportError("Ce site est introuvable. Vérifiez l'adresse.");
  }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new ImportError("Cette adresse n'est pas acceptée.");
  }
}

async function fetchHtml(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteClicBot/1.0; +https://siteclic.vercel.app)", Accept: "text/html" },
    }).catch(() => {
      throw new ImportError("Impossible d'ouvrir ce site. Vérifiez l'adresse et réessayez.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      if (!["http:", "https:"].includes(url.protocol)) throw new ImportError("Cette adresse n'est pas acceptée.");
      continue;
    }
    if (!res.ok) throw new ImportError("Ce site ne répond pas correctement. Vérifiez l'adresse.");
    if (!(res.headers.get("content-type") ?? "").includes("html")) throw new ImportError("Cette adresse n'est pas une page de site.");
    const reader = res.body?.getReader();
    if (!reader) throw new ImportError("Ce site est vide.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { url, html: Buffer.concat(chunks).toString("utf8") };
  }
  throw new ImportError("Ce site redirige trop de fois.");
}

function absolute(src: string | undefined, base: URL) {
  if (!src || src.startsWith("data:")) return null;
  try {
    const u = new URL(src.trim(), base);
    return ["http:", "https:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

const IMAGE_URL = /https?:\/\/[^"'\s()<>]+?\.(?:jpe?g|png|webp|avif)(?:\?[^"'\s()<>]*)?/gi;
const BG_URL = /background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

export function extract(root: HTMLElement, base: URL) {
  // Certains créateurs de sites (galeries, carrousels) cachent les photos dans des styles ou du JSON :
  // on les repère dans le code brut avant de le nettoyer.
  const raw = root.toString().replace(/\\\//g, "/");
  const rawImages: string[] = [];
  for (const m of raw.matchAll(BG_URL)) {
    const abs = absolute(m[1], base);
    if (abs) rawImages.push(abs);
  }
  for (const m of raw.matchAll(IMAGE_URL)) rawImages.push(m[0]);

  root.querySelectorAll("script,style,noscript,svg,iframe,template").forEach((n) => n.remove());

  const images: string[] = [];
  const og = root.querySelector('meta[property="og:image"]')?.getAttribute("content");
  const ogAbs = absolute(og, base);
  if (ogAbs) images.push(ogAbs);
  for (const img of root.querySelectorAll("img")) {
    const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
    const fromSet = srcset?.split(",").map((s) => s.trim().split(" ")[0]).pop();
    const src = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || fromSet || img.getAttribute("src");
    const abs = absolute(src, base);
    const w = Number(img.getAttribute("width") || 0);
    if (!abs || /\.(svg|gif|ico)(\?|$)/i.test(abs) || (w > 0 && w < 120)) continue;
    if (/(sprite|pixel|spacer|icon|facebook|instagram|twitter|tripadvisor|badge|avatar|logo-?footer)/i.test(abs)) continue;
    images.push(abs);
  }

  for (const abs of rawImages) {
    if (/(sprite|pixel|spacer|icon|favicon|logo|facebook|instagram|twitter|tripadvisor|badge|avatar|flag)/i.test(abs)) continue;
    images.push(abs);
  }

  // Les numéros de téléphone et e-mails des liens.
  const extras: string[] = [];
  for (const a of root.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]')) {
    extras.push(decodeURIComponent(a.getAttribute("href")!.replace(/^(tel|mailto):/, "")));
  }

  const body = root.querySelector("body") ?? root;
  const text = body.structuredText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  const links: URL[] = [];
  for (const a of root.querySelectorAll("a[href]")) {
    const href = absolute(a.getAttribute("href"), base);
    if (!href) continue;
    const u = new URL(href);
    u.hash = "";
    if (u.hostname === base.hostname && EXTRA_PAGE_WORDS.test(`${u.pathname} ${a.text}`)) links.push(u);
  }

  return {
    title: root.querySelector("title")?.text.trim() ?? "",
    description: root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "",
    text: (extras.length ? `Contacts trouvés : ${[...new Set(extras)].join(", ")}\n\n` : "") + text.slice(0, MAX_TEXT_PER_PAGE),
    images,
    links,
  };
}

/** Récupère le contenu d'un site existant : page d'accueil + 3 pages utiles au maximum. */
export async function importSite(input: string): Promise<ImportedSite> {
  const start = normalizeUrl(input);
  const home = await fetchHtml(start);
  const first = extract(parse(home.html), home.url);
  if (first.text.length < 80) {
    throw new ImportError("Nous n'avons pas trouvé de texte sur ce site. Il est peut-être protégé ou fait uniquement d'images.");
  }

  const pages = [{ url: home.url.toString(), text: first.text }];
  const images = [...first.images];
  const seen = new Set([home.url.toString()]);
  const extraLinks: URL[] = [];
  for (const u of first.links) {
    if (extraLinks.length >= 3) break;
    if (seen.has(u.toString())) continue;
    seen.add(u.toString());
    extraLinks.push(u);
  }

  const extra = await Promise.all(
    extraLinks.map(async (u) => {
      try {
        const p = await fetchHtml(u);
        return { url: p.url, data: extract(parse(p.html), p.url) };
      } catch {
        return null;
      }
    }),
  );
  for (const e of extra) {
    if (!e) continue;
    pages.push({ url: e.url.toString(), text: e.data.text });
    images.push(...e.data.images);
  }

  return {
    url: home.url.toString(),
    title: first.title,
    description: first.description,
    pages,
    images: [...new Set(images)].slice(0, 25),
  };
}
