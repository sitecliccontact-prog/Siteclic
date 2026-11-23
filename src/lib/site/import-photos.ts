import "server-only";
import sharp from "sharp";
import { assertPublicHost } from "./importer";

export type PreparedPhoto = { url: string; data: Buffer<ArrayBuffer>; width: number; height: number };

const MAX_BYTES = 8_000_000;

/** Télécharge une image d'un site public (avec les mêmes protections que l'import). */
async function download(src: string): Promise<Buffer | null> {
  let url = new URL(src);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteClicBot/1.0; +https://siteclic.vercel.app)", Accept: "image/*" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > MAX_BYTES ? null : buf;
  }
  return null;
}

/**
 * Récupère les photos trouvées sur l'ancien site, écarte les petites images (icônes, logos),
 * et les prépare en WebP net et léger. Les plus grandes d'abord.
 */
export async function preparePhotos(urls: string[], limit = 12): Promise<PreparedPhoto[]> {
  const results = await Promise.all(
    urls.slice(0, 24).map(async (url): Promise<PreparedPhoto | null> => {
      try {
        const raw = await download(url);
        if (!raw) return null;
        const img = sharp(raw, { failOn: "none" }).rotate();
        const meta = await img.metadata();
        const w = meta.autoOrient?.width ?? meta.width ?? 0;
        const h = meta.autoOrient?.height ?? meta.height ?? 0;
        if (w < 480 || h < 320) return null; // trop petite pour être belle en grand
        if (w / h > 3.2 || h / w > 2.2) return null; // bannière ou bande étroite
        const out = await img
          .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
        return { url, data: out.data, width: out.info.width, height: out.info.height };
      } catch {
        return null;
      }
    }),
  );
  return results
    .filter((r): r is PreparedPhoto => r !== null)
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, limit);
}
