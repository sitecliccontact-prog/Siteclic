"use client";

import { useEffect, useRef, useState } from "react";
import { CURATED, RELIEFS, RELIEF_STYLES, applyLook, harmony, hsl, isHex, readability, toHsl, type Look, type Palette, type Relief } from "@/lib/site/colors";

/* Atelier des couleurs : spectre complet (des millions de teintes), nuancier de 264 couleurs,
   palettes de créateur, « Propose-moi des couleurs », dégradés et relief du fond.
   Tout est recalculé pour rester lisible (contraste garanti). */

type Target = "bg" | "ink" | "accent" | "accent2";
const TARGETS: { id: Target; label: string }[] = [
  { id: "bg", label: "Fond" },
  { id: "ink", label: "Texte" },
  { id: "accent", label: "Boutons" },
  { id: "accent2", label: "Dégradé" },
];


/** 24 teintes × 10 nuances + 48 gris, crèmes et ardoises = 288 couleurs. */
const SWATCHES: string[] = (() => {
  const out: string[] = [];
  for (let l = 0; l < 10; l++) for (let h = 0; h < 24; h++) out.push(hsl(h * 15, l < 2 ? 45 : 72, 92 - l * 9));
  for (let i = 0; i < 24; i++) out.push(hsl(0, 0, 100 - i * 4.3));
  for (let i = 0; i < 24; i++) out.push(i < 12 ? hsl(35, 12 + i * 2, 96 - i * 3) : hsl(210 + (i - 12) * 4, 14, 40 - (i - 12) * 3));
  return out;
})();

export function ColorStudio({ siteId, base, look, onChange }: { siteId: string; base: Palette; look: Look | undefined; onChange: (l: Look | undefined) => void }) {
  const [target, setTarget] = useState<Target>("accent");
  const [sat, setSat] = useState(70);
  const [hex, setHex] = useState("");
  const [ideas, setIdeas] = useState<ReturnType<typeof harmony>[]>([]);
  const p = applyLook(base, look);
  const a2 = isHex(look?.accent2) ? look.accent2 : "";
  const current = target === "accent2" ? a2 || p.accent : p[target];
  const read = readability(p);

  useEffect(() => setHex(current), [current]);

  function set(t: Target, color: string | undefined) {
    const next: Look = { bg: p.bg, ink: p.ink, accent: p.accent, accent2: a2 || undefined, relief: look?.relief };
    // On ne garde que ce que la personne a vraiment choisi pour le texte (sinon il se recalcule tout seul).
    if (!isHex(look?.ink) && t !== "ink") next.ink = undefined;
    next[t] = color;
    onChange(next);
  }
  function pick(color: string) {
    set(target, color);
  }
  function applyPalette(x: { bg: string; ink: string; accent: string; accent2?: string }) {
    onChange({ bg: x.bg, ink: x.ink, accent: x.accent, accent2: x.accent2, relief: look?.relief });
  }
  function surprise() {
    const h = harmony();
    setIdeas((l) => [h, ...l].slice(0, 8));
    applyPalette(h);
  }

  return (
    <div className="space-y-4">
      {/* Aperçu en direct */}
      <div className="overflow-hidden rounded-2xl border border-line" style={{ background: p.bg, color: p.ink }}>
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.22em]"
            style={a2 ? { background: `linear-gradient(90deg, ${p.accent}, ${a2})`, WebkitBackgroundClip: "text", color: "transparent" } : { color: p.accent }}>
            Votre maison
          </p>
          <p className="mt-1 font-display text-2xl font-semibold leading-tight">Une adresse qui vous ressemble</p>
          <p className="mt-1 text-xs" style={{ color: p.muted }}>Texte courant, horaires, carte et prix.</p>
          <span className="mt-3 inline-block rounded-full px-4 py-2 text-xs font-semibold"
            style={{ background: a2 ? `linear-gradient(120deg, ${p.accent}, ${a2})` : p.accent, color: p.onAccent }}>
            Réserver une table
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2 text-[11px]" style={{ background: p.surface, color: p.muted }}>
          <span>Lisibilité : <b style={{ color: read.tone === "ok" ? p.accent : undefined }}>{read.label}</b></span>
          <span className="flex gap-1">
            {[p.bg, p.ink, p.accent, a2].filter(Boolean).map((x, i) => <i key={i} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: x }} />)}
          </span>
        </div>
      </div>

      <button type="button" onClick={surprise}
        className="w-full rounded-full bg-gradient-to-r from-clic to-[#ff9a5b] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_var(--clic)] active:scale-[.98]">
        ✨ Propose-moi des couleurs
      </button>
      {ideas.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ideas.slice(1).map((x, i) => (
            <button key={i} type="button" onClick={() => applyPalette(x)} className="flex shrink-0 overflow-hidden rounded-lg border border-line" aria-label="Revenir à cette proposition">
              {[x.bg, x.accent, x.accent2 ?? x.ink].map((c, k) => <span key={k} className="h-7 w-5" style={{ background: c }} />)}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs text-muted">Palettes de créateur</p>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {CURATED.map((x) => (
            <button key={x.name} type="button" onClick={() => applyPalette(x)} className="w-[92px] shrink-0 snap-start text-left">
              <span className="flex h-14 overflow-hidden rounded-xl border border-line" style={{ background: x.bg }}>
                <span className="m-auto font-display text-lg font-semibold" style={{ color: x.ink }}>Aa</span>
                <span className="w-1/3" style={{ background: x.accent2 ? `linear-gradient(180deg, ${x.accent}, ${x.accent2})` : x.accent }} />
              </span>
              <span className="mt-1 block truncate text-[10px] text-muted">{x.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-4 gap-1 rounded-full border border-line p-1">
          {TARGETS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTarget(t.id)}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs ${target === t.id ? "bg-clic text-white" : "text-muted"}`}>
              <i className="h-3 w-3 rounded-full border border-white/40" style={{ background: t.id === "accent2" ? a2 || "transparent" : p[t.id] }} />
              {t.label}
            </button>
          ))}
        </div>
        {target === "accent2" && (
          <p className="mt-2 text-xs text-muted">
            Choisissez une 2e couleur : les boutons passent en dégradé.{" "}
            {a2 && <button type="button" className="text-clic underline" onClick={() => set("accent2", undefined)}>Enlever le dégradé</button>}
          </p>
        )}
      </div>

      <Spectrum sat={sat} value={current} onPick={pick} />
      <label className="flex items-center gap-3 text-xs text-muted">
        Intensité
        <input type="range" min={0} max={100} value={sat} onChange={(e) => setSat(+e.target.value)} className="flex-1 accent-[var(--clic)]" />
      </label>

      <div>
        <p className="mb-2 text-xs text-muted">Nuancier · {SWATCHES.length} couleurs</p>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {SWATCHES.map((s, i) => (
            <button key={i} type="button" onClick={() => pick(s)} aria-label={s}
              className={`aspect-square rounded-[3px] ${s === current ? "ring-2 ring-white ring-offset-1 ring-offset-black" : ""}`}
              style={{ background: s }} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="h-10 w-10 shrink-0 rounded-xl border border-line" style={{ background: isHex(hex) ? hex : current }} />
        <input value={hex} onChange={(e) => { setHex(e.target.value); if (isHex(e.target.value)) pick(e.target.value.toLowerCase()); }}
          className="w-28 rounded-xl border border-line bg-cream px-3 py-2 font-mono text-sm uppercase outline-none" aria-label="Code couleur" maxLength={7} />
        <label className="ml-auto cursor-pointer rounded-full border border-line px-3 py-2 text-xs">
          Pipette
          <input type="color" value={isHex(current) ? current : "#000000"} onChange={(e) => pick(e.target.value)} className="sr-only" />
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted">Relief du fond</p>
        <div className="grid grid-cols-4 gap-2">
          {RELIEFS.filter((id) => id !== "perso" || look?.custom).map((id) => {
            const r = id === "perso" && look?.custom ? { label: look.custom.label, image: look.custom.image, size: look.custom.size } : RELIEF_STYLES[id];
            const on = (look?.relief ?? "aucun") === id;
            return (
              <button key={id} type="button" onClick={() => onChange({ ...(look ?? {}), relief: id })}
                className={`rounded-xl border p-1 text-[10px] ${on ? "border-clic" : "border-line"}`}>
                <span className="mb-1 block h-12 rounded-lg border border-black/5"
                  style={{ "--accent": p.accent, "--accent2": a2 || p.accent, "--ink": p.ink, backgroundColor: p.bg, backgroundImage: r.image, backgroundSize: r.size?.includes("px") && !r.size.startsWith("100%") ? r.size.split(" ").map((v) => `${Math.max(6, parseFloat(v) / 2)}px`).join(" ") : "cover" } as React.CSSProperties} />
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <AiRelief siteId={siteId} onCreated={(custom) => onChange({ ...(look ?? {}), relief: "perso", custom })} />

      {look && (
        <button type="button" onClick={() => onChange(undefined)} className="w-full rounded-full border border-line py-2.5 text-xs text-muted">
          Revenir aux couleurs d&apos;origine du style
        </button>
      )}
    </div>
  );
}

/** Spectre : toutes les teintes de gauche à droite, du clair au foncé de haut en bas. Glisser le doigt pour choisir. */
function Spectrum({ sat, value, onPick }: { sat: number; value: string; onPick: (c: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const W = cv.width, H = cv.height;
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = hsl((x / W) * 360, sat, 96 - (y / H) * 90);
        const n = parseInt(c.slice(1), 16), i = (y * W + x) * 4;
        img.data[i] = (n >> 16) & 255; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [sat]);

  function at(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    onPick(hsl(x * 360, sat, 96 - y * 90));
  }
  const [h, , l] = isHex(value) ? toHsl(value) : [0, 0, 50];
  return (
    <div className="relative">
      <canvas ref={ref} width={240} height={120}
        onPointerDown={(e) => { down.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); at(e); }}
        onPointerMove={(e) => down.current && at(e)}
        onPointerUp={() => { down.current = false; }}
        className="h-40 w-full touch-none rounded-2xl border border-line" aria-label="Spectre de couleurs" />
      <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
        style={{ left: `${(h / 360) * 100}%`, top: `${Math.max(0, Math.min(100, ((96 - l) / 90) * 100))}%`, background: value }} />
      <p className="mt-1 text-[10px] text-muted">Des millions de teintes : glissez le doigt sur le spectre.</p>
    </div>
  );
}

/** « Créer mon relief avec l'IA » : la personne décrit le fond qu'elle veut, l'IA le dessine (1 € = 5 créations). */
function AiRelief({ siteId, onCreated }: { siteId: string; onCreated: (c: NonNullable<Look["custom"]>) => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [buy, setBuy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);

  useEffect(() => {
    fetch(`/api/sites/${siteId}/relief`).then((r) => r.json()).then((d) => { setUnlimited(!!d.unlimited); setLeft(typeof d.left === "number" ? d.left : null); }).catch(() => {});
  }, [siteId]);

  async function create() {
    if (prompt.trim().length < 3 || busy) return;
    setBusy(true); setMsg(""); setBuy(false);
    const res = await fetch(`/api/sites/${siteId}/relief`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy(false);
    if (res?.ok && d?.custom) {
      onCreated(d.custom);
      if (typeof d.left === "number") setLeft(d.left);
      setMsg(`« ${d.custom.label} » est sur votre site ✓`);
      return;
    }
    setMsg(d?.error || "La création n'a pas marché. Réessayez.");
    setBuy(Boolean(d?.needsPurchase));
  }
  async function purchase() {
    const res = await fetch("/api/relief/acheter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retour: `/tableau-de-bord/sites/${siteId}` }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.url) window.location.href = d.url;
    else setMsg(d?.error || "Paiement indisponible pour le moment.");
  }

  return (
    <div className="rounded-2xl border border-clic/40 bg-gradient-to-br from-clic/10 to-transparent p-4">
      <p className="font-medium">✨ Créer mon relief avec l&apos;IA</p>
      <p className="mt-1 text-xs text-muted">
        Décrivez le fond de vos rêves, l&apos;IA le dessine dans vos couleurs.{" "}
        {unlimited ? "Illimité sur votre compte." : left !== null && left > 0 ? `Il vous reste ${left} création${left > 1 ? "s" : ""}.` : "1 € pour 5 créations."}
      </p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} maxLength={300}
        placeholder="Ex. des vagues dorées style art déco, des feuilles d'olivier très discrètes, un ciel étoilé…"
        className="mt-3 w-full resize-none rounded-xl border border-line bg-cream px-3 py-2.5 text-[15px] outline-none focus:border-ink/60" />
      <button type="button" onClick={create} disabled={busy || prompt.trim().length < 3}
        className="mt-2 w-full rounded-full bg-clic py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "L'IA dessine votre relief…" : "Créer mon relief"}
      </button>
      {msg && <p className="mt-2 text-xs">{msg}</p>}
      {buy && (
        <button type="button" onClick={purchase} className="mt-2 w-full rounded-full border border-clic py-2.5 text-sm font-medium text-clic">
          Acheter 5 créations pour 1 €
        </button>
      )}
    </div>
  );
}
