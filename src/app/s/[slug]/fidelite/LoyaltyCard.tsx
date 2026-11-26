"use client";

import { useEffect, useState } from "react";

/* La carte reste sur le téléphone (son numéro est gardé ici) ; les tampons sont comptés par SiteClic, impossibles à inventer. */

function cardId(slug: string) {
  const k = `sc-fidelite-${slug}`;
  try {
    const old = localStorage.getItem(k);
    if (old) return old;
    const id = crypto.randomUUID();
    localStorage.setItem(k, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function LoyaltyCard({ slug, brand, goal, reward }: { slug: string; brand: string; goal: number; reward: string }) {
  const [card, setCard] = useState("");
  const [stamps, setStamps] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pop, setPop] = useState(-1);
  const preview = slug.startsWith("exemple-");

  useEffect(() => {
    const id = cardId(slug);
    setCard(id);
    if (preview) { setStamps(3); return; }
    fetch(`/api/fidelite?slug=${slug}&card=${id}`).then((r) => r.json()).then((d) => setStamps(d.stamps ?? 0)).catch(() => setStamps(0));
  }, [slug, preview]);

  const full = stamps !== null && stamps >= goal;

  async function send(redeem: boolean) {
    if (!/^\d{4}$/.test(code)) return setMsg({ ok: false, text: "Entrez le code à 4 chiffres donné en caisse." });
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/fidelite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, card, code, redeem }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy(false);
    setCode("");
    if (!res?.ok) return setMsg({ ok: false, text: d?.error || "Pas de connexion. Réessayez." });
    setStamps(d.stamps);
    if (redeem) setMsg({ ok: true, text: `Profitez bien : ${reward} ! Votre carte repart à zéro.` });
    else { setPop(d.stamps - 1); setMsg({ ok: true, text: d.stamps >= goal ? `Bravo ! Votre ${reward.toLowerCase()} vous attend.` : `Tampon ajouté ✓ Plus que ${goal - d.stamps} !` }); }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b0b0d] px-5 py-10 text-[#f5f4f0]">
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1b1714] via-[#121110] to-[#2a170c] p-7 shadow-2xl">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#ff5b1f]/25 blur-3xl" />
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Carte de fidélité</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight">{brand}</p>
          <div className="mt-7 grid grid-cols-5 gap-3">
            {Array.from({ length: goal }, (_, k) => {
              const on = stamps !== null && k < stamps;
              return (
                <span key={k} className={`grid aspect-square place-items-center rounded-full text-sm transition-all duration-500 ${on ? "bg-[#ff5b1f] text-white shadow-[0_6px_20px_-6px_#ff5b1f]" : "border border-dashed border-white/25 text-white/30"} ${pop === k ? "scale-125" : ""}`}>
                  {on ? "✓" : k === goal - 1 ? "🎁" : k + 1}
                </span>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-white/70">{goal}e visite : <b className="text-white">{reward}</b></p>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-white/70">{full ? "Montrez cette carte en caisse et entrez le code du jour pour profiter de votre récompense." : "En caisse, demandez le code du jour et entrez-le ici pour avoir votre tampon."}</p>
          <div className="mt-3 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="0000" aria-label="Code du jour"
              className="w-24 shrink-0 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-xl tracking-[0.3em] outline-none focus:border-[#ff5b1f]" />
            <button type="button" disabled={busy || preview} onClick={() => send(full)}
              className="flex-1 rounded-2xl bg-[#ff5b1f] px-3 py-3 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "…" : full ? "Utiliser ma récompense" : "Ajouter mon tampon"}
            </button>
          </div>
          {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`} role="status">{msg.text}</p>}
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-white/40">
          Astuce : ajoutez cette page à l&apos;écran d&apos;accueil (menu ⋮ puis « Ajouter à l&apos;écran d&apos;accueil ») pour retrouver votre carte en un geste.
        </p>
        <a href={`/s/${slug}`} className="mt-4 block text-center text-sm text-white/60 underline underline-offset-4">Retour au site</a>
      </div>
    </main>
  );
}
