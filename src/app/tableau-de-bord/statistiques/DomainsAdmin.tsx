"use client";

import { useState } from "react";

export type DomainRow = { id: string; domain: string; status: string; created_at: string; site_name: string; slug: string; email: string };

/** Demandes de noms de domaine des commerçants : à acheter et brancher dans Vercel, puis marquer comme fait. */
export function DomainsAdmin({ initial }: { initial: DomainRow[] }) {
  const [rows, setRows] = useState(initial);
  async function set(id: string, status: string) {
    const res = await fetch("/api/proprietaire/domaines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (res.ok) setRows((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
  }
  return (
    <div className="mt-6 rounded-3xl border border-line bg-card p-5">
      <p className="font-medium">🌐 Noms de domaine demandés</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Pour chaque demande : achetez l&apos;adresse dans Vercel (projet siteclic → Settings → Domains → Buy), ajoutez-la au projet, puis appuyez sur « C&apos;est branché ». Le site du commerçant s&apos;affiche alors sur son adresse.
      </p>
      {!rows.length && <p className="mt-3 text-sm text-muted">Aucune demande pour l&apos;instant.</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{r.domain}</p>
                <p className="truncate text-xs text-muted">{r.site_name} · {r.email}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${r.status === "actif" ? "bg-emerald-400/10 text-emerald-300" : r.status === "refuse" ? "bg-red-500/10 text-red-300" : "bg-clic/15 text-clic"}`}>
                {r.status === "actif" ? "Branché" : r.status === "refuse" ? "Indisponible" : "À faire"}
              </span>
            </div>
            {r.status === "demande" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={`https://vercel.com/domains/search?q=${encodeURIComponent(r.domain)}`} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-xs">Acheter sur Vercel</a>
                <button type="button" onClick={() => set(r.id, "actif")} className="rounded-full bg-clic px-3 py-1.5 text-xs font-medium text-white">C&apos;est branché</button>
                <button type="button" onClick={() => set(r.id, "refuse")} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">Pas disponible</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
