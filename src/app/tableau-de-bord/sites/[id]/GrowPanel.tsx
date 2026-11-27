"use client";

import { friendlyError } from "@/lib/errors";
import { useEffect, useRef, useState } from "react";
import { uploadPhoto } from "@/lib/site/photos";
import { THEMES } from "@/components/site/themes";
import { applyLook } from "@/lib/site/colors";
import type { SiteContent } from "@/lib/site/schema";

/* Fermeture exceptionnelle, carte de fidélité, rendez-vous, « complet ce soir », mini-boutique, posts Instagram, fiche Google. */

type Save = (body: object, ok: string) => Promise<void>;
type P = { id: string; content: SiteContent; busy: boolean; save: Save };

const parisDay = (offset = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + offset * 86400000));
const input = "w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[15px] outline-none focus:border-ink/60";
const primary = "w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40";

export function GrowPanel(p: P) {
  return (
    <>
      <NoticeCard {...p} />
      <WaitlistCard {...p} />
      <AppointmentsCard {...p} />
      <LoyaltyCardOwner {...p} />
      <ShopCard {...p} />
      <InstagramCard {...p} />
      <GoogleCard {...p} />
    </>
  );
}

function Card({ title, text, right, children, hot }: { title: string; text?: string; right?: React.ReactNode; children?: React.ReactNode; hot?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 ${hot ? "border-clic/50" : "border-line"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          {text && <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-clic" : "bg-white/15"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

/* ---------- Fermeture exceptionnelle / annonce ---------- */

const NOTICE_IDEAS = ["Fermé exceptionnellement aujourd'hui", "Fermé pour congés, réouverture le …", "Ouvert ce dimanche !", "Complet ce soir, merci !"];

function NoticeCard({ content, busy, save }: P) {
  const live = content.notice?.text && (!content.notice.until || content.notice.until >= parisDay()) ? content.notice : null;
  const [text, setText] = useState(live?.text ?? "");
  const [until, setUntil] = useState(live?.until ?? parisDay());
  return (
    <Card hot={Boolean(live)} title="Fermeture exceptionnelle ou annonce"
      text="Un bandeau en haut de votre site, en un mot. Il disparaît tout seul après la date choisie."
      right={live ? <span className="flex items-center gap-1.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />En ligne</span> : undefined}>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {NOTICE_IDEAS.map((t) => (
          <button key={t} type="button" onClick={() => setText(t)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">{t}</button>
        ))}
      </div>
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Votre annonce" className={`${input} mt-2`} />
      <label className="mt-2 flex items-center gap-2 text-sm text-muted">Jusqu&apos;au
        <input type="date" value={until} min={parisDay()} onChange={(e) => setUntil(e.target.value)} className="rounded-xl border border-line bg-cream px-3 py-2 text-ink" />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={busy || !text.trim()} onClick={() => save({ notice: { text: text.trim(), until } }, "Bandeau en ligne ✓")} className={primary}>
          {live ? "Mettre à jour le bandeau" : "Afficher le bandeau"}
        </button>
        {live && <button type="button" disabled={busy} onClick={() => { setText(""); void save({ notice: null }, "Bandeau retiré."); }} className="text-sm text-muted underline underline-offset-4">Retirer</button>}
      </div>
    </Card>
  );
}

/* ---------- Complet ce soir → liste d'attente ---------- */

function WaitlistCard({ content, busy, save }: P) {
  const booking = content.booking?.enabled;
  if (!booking) return null;
  const full = content.waitlist?.fullDay === parisDay();
  return (
    <Card hot={full} title="Complet ce soir"
      text="Activez-le quand vous êtes complet : les clients s'inscrivent sur une liste d'attente au lieu de réserver. Si une table se libère, prévenez-les par SMS en un geste depuis « Réservations »."
      right={<Toggle on={full} label="Complet ce soir" disabled={busy}
        onClick={() => save({ waitlist: { fullDay: full ? "" : parisDay() } }, full ? "Réservations rouvertes ✓" : "Liste d'attente activée pour ce soir ✓")} />} />
  );
}

/* ---------- Prise de rendez-vous ---------- */

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function AppointmentsCard({ content, busy, save }: P) {
  const a = content.appointments ?? { enabled: false, staff: [], services: [], days: [2, 3, 4, 5, 6], open: "09:00", close: "19:00" };
  const [staff, setStaff] = useState(a.staff.join(", "));
  const [services, setServices] = useState(a.services.length ? a.services : [{ name: "Coupe femme", minutes: 45, price: "35 €" }, { name: "Coupe homme", minutes: 30, price: "22 €" }]);
  const [days, setDays] = useState(a.days);
  const [open, setOpen] = useState(a.open);
  const [close, setClose] = useState(a.close);
  const body = (enabled: boolean) => ({
    appointments: {
      enabled, days, open, close,
      staff: staff.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10),
      services: services.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), minutes: s.minutes, price: s.price.trim() })),
    },
  });
  return (
    <Card title="Prise de rendez-vous" text="Pour les coiffeurs, instituts, barbiers… Vos clients choisissent la prestation, la personne et un créneau libre. Les rendez-vous arrivent dans « Réservations »."
      right={<Toggle on={a.enabled} label="Prise de rendez-vous" disabled={busy}
        onClick={() => save(body(!a.enabled), a.enabled ? "Prise de rendez-vous retirée." : "Prise de rendez-vous en ligne ✓")} />}>
      {a.enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs text-muted">Prestations (nom, durée, prix)</p>
            {services.map((s, k) => (
              <div key={k} className="mt-1.5 flex gap-1.5">
                <input value={s.name} onChange={(e) => setServices(services.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)))} maxLength={60} placeholder="Prestation" className={`${input} min-w-0 flex-1`} />
                <select value={s.minutes} onChange={(e) => setServices(services.map((x, j) => (j === k ? { ...x, minutes: Number(e.target.value) } : x)))} className="rounded-xl border border-line bg-cream px-2 text-sm" aria-label="Durée">
                  {[15, 20, 30, 45, 60, 75, 90, 120, 150, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? m % 60 : ""}`}</option>)}
                </select>
                <input value={s.price} onChange={(e) => setServices(services.map((x, j) => (j === k ? { ...x, price: e.target.value } : x)))} maxLength={20} placeholder="Prix" className={`${input} w-20`} />
                <button type="button" aria-label="Retirer" onClick={() => setServices(services.filter((_, j) => j !== k))} className="px-1 text-muted">✕</button>
              </div>
            ))}
            {services.length < 30 && <button type="button" onClick={() => setServices([...services, { name: "", minutes: 30, price: "" }])} className="mt-2 text-sm text-clic">+ Ajouter une prestation</button>}
          </div>
          <label className="block text-xs text-muted">L&apos;équipe (prénoms séparés par des virgules, facultatif)
            <input value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="Léa, Max" className={`${input} mt-1`} />
          </label>
          <div>
            <p className="text-xs text-muted">Jours d&apos;ouverture</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button key={d} type="button" onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                  className={`rounded-full border px-3 py-1.5 text-sm ${days.includes(d) ? "border-clic bg-clic/15" : "border-line text-muted"}`}>{DAYS[d]}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            De <input type="time" value={open} step={900} onChange={(e) => setOpen(e.target.value)} className="rounded-xl border border-line bg-cream px-2 py-2 text-ink" />
            à <input type="time" value={close} step={900} onChange={(e) => setClose(e.target.value)} className="rounded-xl border border-line bg-cream px-2 py-2 text-ink" />
          </div>
          <button type="button" disabled={busy || !services.some((s) => s.name.trim()) || !days.length} onClick={() => save(body(true), "Rendez-vous enregistrés ✓")} className={primary}>Enregistrer</button>
        </div>
      )}
    </Card>
  );
}

/* ---------- Carte de fidélité ---------- */

function LoyaltyCardOwner({ id, content, busy, save }: P) {
  const l = content.loyalty ?? { enabled: false, goal: 10, reward: "Un café offert" };
  const [goal, setGoal] = useState(l.goal);
  const [reward, setReward] = useState(l.reward);
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!l.enabled) return;
    fetch(`/api/sites/${id}/fidelite`).then((r) => r.json()).then((d) => setCode(d.ready ? d.code : null)).catch(() => setCode(null));
  }, [id, l.enabled]);
  return (
    <Card title="Carte de fidélité" text="Fini les cartes en carton : vos clients gardent leur carte sur leur téléphone. À chaque visite, vous leur donnez le code du jour, ils ont leur tampon. Impossible de tricher."
      right={<Toggle on={l.enabled} label="Carte de fidélité" disabled={busy}
        onClick={() => save({ loyalty: { enabled: !l.enabled, goal, reward } }, l.enabled ? "Carte de fidélité retirée." : "Carte de fidélité en ligne ✓")} />}>
      {l.enabled && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl bg-cream p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Code du jour</p>
            <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.3em] text-clic">{code === undefined ? "…" : code ?? "----"}</p>
            <p className="mt-1 text-xs text-muted">{code === null ? "Ajoutez le code Supabase n°3 pour activer les codes." : "À donner au client en caisse. Il change chaque jour."}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Récompense à la</span>
            <select value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="rounded-xl border border-line bg-cream px-2 py-2" aria-label="Nombre de visites">
              {[5, 6, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}e</option>)}
            </select>
            <span className="text-muted">visite :</span>
          </div>
          <input value={reward} onChange={(e) => setReward(e.target.value)} maxLength={80} placeholder="Un café offert" className={input} />
          <button type="button" disabled={busy || !reward.trim() || (goal === l.goal && reward === l.reward)} onClick={() => save({ loyalty: { enabled: true, goal, reward: reward.trim() } }, "Carte de fidélité enregistrée ✓")} className={primary}>Enregistrer</button>
        </div>
      )}
    </Card>
  );
}

/* ---------- Mini-boutique ---------- */

type Product = { name: string; price: string; description: string; photo: string };

function ShopCard({ id, content, busy, save }: P) {
  const sh = content.shop ?? { enabled: false, delivery: false, deliveryNote: "", products: [] };
  const [products, setProducts] = useState<Product[]>(sh.products);
  const [delivery, setDelivery] = useState(sh.delivery);
  const [note, setNote] = useState(sh.deliveryNote);
  const [up, setUp] = useState(-1);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const target = useRef(-1);
  const body = (enabled: boolean) => ({ shop: { enabled, delivery, deliveryNote: note.trim(), products: products.filter((x) => x.name.trim() && x.price.trim()) } });
  const set = (k: number, patch: Partial<Product>) => setProducts(products.map((x, j) => (j === k ? { ...x, ...patch } : x)));

  async function sendPhoto(f: File | undefined) {
    const k = target.current;
    if (!f || k < 0) return;
    setUp(k);
    setErr("");
    try { set(k, { photo: await uploadPhoto(f, id) }); } catch (e) { setErr(friendlyError(e, "Envoi impossible.")); }
    setUp(-1);
  }

  return (
    <Card title="Mini-boutique" text="Vendez vos produits sur votre site (coffrets, pâtisseries, cosmétiques…). Retrait en boutique ou livraison. Paiement à la remise, ou en ligne quand Stripe sera actif (2 %)."
      right={<Toggle on={sh.enabled} label="Mini-boutique" disabled={busy}
        onClick={() => save(body(!sh.enabled), sh.enabled ? "Boutique retirée." : "Boutique en ligne ✓")} />}>
      {sh.enabled && (
        <div className="mt-3 space-y-2">
          {products.map((x, k) => (
            <div key={k} className="flex gap-2 rounded-xl border border-line p-2">
              <button type="button" onClick={() => { target.current = k; file.current?.click(); }}
                className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-cream text-xl text-muted" aria-label="Photo du produit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {x.photo ? <img src={x.photo} alt="" className="h-full w-full object-cover" /> : up === k ? "…" : "📷"}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex gap-1">
                  <input value={x.name} onChange={(e) => set(k, { name: e.target.value })} maxLength={60} placeholder="Produit" className={`${input} min-w-0 flex-1 py-1.5`} />
                  <input value={x.price} onChange={(e) => set(k, { price: e.target.value })} maxLength={20} placeholder="Prix" className={`${input} w-20 py-1.5`} />
                </div>
                <input value={x.description} onChange={(e) => set(k, { description: e.target.value })} maxLength={200} placeholder="Petite description (facultatif)" className={`${input} py-1.5 text-sm`} />
              </div>
              <button type="button" aria-label="Retirer" onClick={() => setProducts(products.filter((_, j) => j !== k))} className="self-start px-1 text-muted">✕</button>
            </div>
          ))}
          {products.length < 30 && <button type="button" onClick={() => setProducts([...products, { name: "", price: "", description: "", photo: "" }])} className="text-sm text-clic">+ Ajouter un produit</button>}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void sendPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <label className="flex items-center justify-between gap-3 pt-2 text-sm">Livraison possible
            <Toggle on={delivery} label="Livraison" onClick={() => setDelivery(!delivery)} />
          </label>
          {delivery && <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Ex. Livraison à Bandol et Sanary, 5 €" className={input} />}
          <button type="button" disabled={busy} onClick={() => save(body(true), "Boutique enregistrée ✓")} className={primary}>Enregistrer la boutique</button>
        </div>
      )}
    </Card>
  );
}

/* ---------- Posts Instagram ---------- */

type Post = { headline: string; kicker: string; caption: string; hashtags: string[]; photo: number };

function InstagramCard({ id, content, busy }: P) {
  const [idea, setIdea] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  async function go() {
    setWorking(true);
    setMsg("");
    const res = await fetch(`/api/sites/${id}/instagram`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.posts) setPosts(d.posts); else setMsg(d?.error || "L'IA n'a pas pu écrire les posts. Réessayez.");
    setWorking(false);
  }
  return (
    <Card title="Posts Instagram" text="L'IA prépare 3 posts avec vos photos : l'image (format Instagram) et le texte. Vous n'avez plus qu'à enregistrer l'image et coller le texte. Compte comme 1 modification IA.">
      <input value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={300} placeholder="Une idée ? Ex. nouveau dessert, soirée jazz vendredi (facultatif)" className={`${input} mt-3`} />
      <button type="button" disabled={busy || working} onClick={go} className={`${primary} mt-2`}>{working ? "L'IA écrit vos posts…" : posts.length ? "Proposer 3 autres posts" : "Créer 3 posts"}</button>
      {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}
      <div className="mt-3 space-y-4">
        {posts.map((p, k) => <PostPreview key={`${k}-${p.headline}`} post={p} content={content} />)}
      </div>
    </Card>
  );
}

function PostPreview({ post, content }: { post: Post; content: SiteContent }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const caption = `${post.caption}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const W = 1080, H = 1350;
    const theme = THEMES[content.theme] ?? Object.values(THEMES)[0];
    const col = applyLook(theme.colors, content.look);
    const draw = (img?: HTMLImageElement) => {
      ctx.fillStyle = col.bg;
      ctx.fillRect(0, 0, W, H);
      if (img) {
        const s = Math.max(W / img.width, H / img.height);
        ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
        const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,.82)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      } else {
        const g = ctx.createRadialGradient(W * 0.8, H * 0.15, 50, W * 0.8, H * 0.15, 900);
        g.addColorStop(0, col.accent);
        g.addColorStop(1, col.bg);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      const ink = img ? "#ffffff" : col.ink;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = col.accent;
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.letterSpacing = "8px";
      ctx.fillText(post.kicker.toUpperCase(), 84, H - 420);
      ctx.letterSpacing = "0px";
      ctx.fillStyle = ink;
      ctx.font = "italic 400 96px Georgia, 'Times New Roman', serif";
      const words = post.headline.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (ctx.measureText(t).width > W - 168 && line) { lines.push(line); line = w; } else line = t;
      }
      lines.push(line);
      lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 84, H - 330 + i * 108));
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.75;
      ctx.font = "500 32px system-ui, sans-serif";
      ctx.fillText(content.brand.name, 84, H - 70);
      ctx.globalAlpha = 1;
      ctx.fillStyle = col.accent;
      ctx.fillRect(84, H - 120, 64, 4);
    };
    const src = content.photos[post.photo];
    if (!src) { draw(); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => draw(img);
    img.onerror = () => draw();
    img.src = src;
  }, [post, content]);

  function download() {
    const a = document.createElement("a");
    try {
      a.href = canvas.current!.toDataURL("image/jpeg", 0.92);
    } catch {
      return;
    }
    a.download = `${content.brand.name.replace(/\W+/g, "-").toLowerCase()}-instagram.jpg`;
    a.click();
  }

  return (
    <div className="rounded-2xl border border-line p-3">
      <canvas ref={canvas} width={1080} height={1350} className="w-full rounded-xl" />
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{caption}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={download} className="rounded-full bg-clic py-2.5 text-sm font-medium text-white">Enregistrer l&apos;image</button>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          className="rounded-full border border-line py-2.5 text-sm">{copied ? "Texte copié ✓" : "Copier le texte"}</button>
      </div>
    </div>
  );
}

/* ---------- Fiche Google ---------- */

function GoogleCard({ content }: P) {
  const [copied, setCopied] = useState("");
  const description = (content.seo.description || content.about.paragraphs.join(" ")).slice(0, 750);
  const hours = content.hours.map((h) => `${h.days} : ${h.time}`).join("\n");
  const copy = (k: string, t: string) => { void navigator.clipboard?.writeText(t); setCopied(k); setTimeout(() => setCopied(""), 1800); };
  return (
    <Card title="Fiche Google" text="Gardez votre fiche Google à jour en 1 minute : vos textes sont prêts, copiez-les puis collez-les dans Google. (La mise à jour 100 % automatique demande une autorisation spéciale de Google : pas encore possible.)">
      <div className="mt-3 space-y-2">
        <div className="rounded-xl bg-cream p-3 text-sm">
          <p className="text-xs text-muted">Description</p>
          <p className="mt-1 line-clamp-3">{description}</p>
          <button type="button" onClick={() => copy("d", description)} className="mt-2 text-sm text-clic">{copied === "d" ? "Copié ✓" : "Copier la description"}</button>
        </div>
        {hours && (
          <div className="rounded-xl bg-cream p-3 text-sm">
            <p className="text-xs text-muted">Horaires</p>
            <p className="mt-1 whitespace-pre-line">{hours}</p>
            <button type="button" onClick={() => copy("h", hours)} className="mt-2 text-sm text-clic">{copied === "h" ? "Copié ✓" : "Copier les horaires"}</button>
          </div>
        )}
        {content.special?.text && (
          <div className="rounded-xl bg-cream p-3 text-sm">
            <p className="text-xs text-muted">Post « Nouveautés » (menu du jour)</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-line">{content.special.text}</p>
            <button type="button" onClick={() => copy("s", `${content.special?.title}\n${content.special?.text}`)} className="mt-2 text-sm text-clic">{copied === "s" ? "Copié ✓" : "Copier le menu du jour"}</button>
          </div>
        )}
        <a href="https://business.google.com/locations" target="_blank" rel="noreferrer" className={`${primary} block text-center`}>Ouvrir ma fiche Google</a>
      </div>
    </Card>
  );
}
