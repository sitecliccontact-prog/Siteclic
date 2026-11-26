"use client";

import { useState } from "react";
import type { AppSettings } from "@/lib/app-settings";

/** Les boutons du propriétaire : ouvrir/fermer l'essai gratuit, budget IA gratuit par jour, mise en ligne gratuite. */
export function OwnerSettings({ initial }: { initial: AppSettings }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/proprietaire/reglages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setMsg(res?.ok ? "Enregistré ✓" : d?.error || "Enregistrement impossible.");
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-clic/40 bg-card p-4">
      <p className="font-medium">Mes réglages anti-abus</p>
      <Row title="Essai gratuit ouvert" text="2 sites et 10 modifications par l'IA par personne. Coupe-le si tu vois trop d'abus." on={s.free_trial} onClick={() => setS({ ...s, free_trial: !s.free_trial })} />
      <div className="mt-4">
        <p className="text-sm font-medium">Dépense IA gratuite maximum par jour</p>
        <p className="text-xs text-muted">Pour tous les comptes gratuits ensemble. Au-delà, l&apos;essai reprend le lendemain.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[100, 300, 500, 1000, 2000].map((c) => (
            <button key={c} type="button" onClick={() => setS({ ...s, free_budget_cents: c })}
              className={`rounded-full border px-4 py-2 text-sm ${s.free_budget_cents === c ? "border-clic bg-clic/15" : "border-line text-muted"}`}>{c / 100} €</button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium">Comptes gratuits max par connexion Internet et par jour</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 5, 10].map((n) => (
            <button key={n} type="button" onClick={() => setS({ ...s, max_per_ip_day: n })}
              className={`rounded-full border px-4 py-2 text-sm ${s.max_per_ip_day === n ? "border-clic bg-clic/15" : "border-line text-muted"}`}>{n}</button>
          ))}
        </div>
      </div>
      <Row title="Mise en ligne gratuite" text="Tant que Stripe n'est pas ouvert, seuls tes comptes peuvent mettre un site en ligne. Active ceci seulement pour une opération spéciale." on={s.free_publish} onClick={() => setS({ ...s, free_publish: !s.free_publish })} />
      <button type="button" disabled={!dirty || busy} onClick={save}
        className="mt-4 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">{busy ? "Enregistrement…" : "Enregistrer"}</button>
      {msg && <p className="mt-2 text-xs text-muted" role="status">{msg}</p>}
    </div>
  );
}

function Row({ title, text, on, onClick }: { title: string; text: string; on: boolean; onClick: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted">{text}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={title} onClick={onClick}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-clic" : "bg-white/15"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
