"use client";

import { useState } from "react";

/** Relier les réservations à l'agenda du téléphone (Google Agenda ou iPhone), une seule fois. */
export function AgendaCard({ sites, origin }: { sites: { id: string; name: string; token: string }[]; origin: string }) {
  const [copied, setCopied] = useState("");
  if (!sites.length) return null;
  const host = origin.replace(/^https?:\/\//, "");
  return (
    <div className="mt-8 rounded-3xl border border-line bg-card p-5">
      <p className="font-medium">Mon agenda</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Reliez vos réservations à l&apos;agenda de votre téléphone : chaque nouvelle réservation y apparaît toute seule, avec le nom, le téléphone et la table.
      </p>
      {sites.map((s) => {
        const path = `${host}/api/agenda/${s.token}`;
        return (
          <div key={s.id} className="mt-4 space-y-2">
            {sites.length > 1 && <p className="text-sm font-medium">{s.name}</p>}
            <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${path}`)}`} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-clic py-3 text-sm font-medium text-white">
              Ajouter à Google Agenda
            </a>
            <div className="flex gap-2">
              <a href={`webcal://${path}`} className="flex-1 rounded-full border border-line py-2.5 text-center text-sm hover:border-ink/50">iPhone / Apple</a>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(`https://${path}`); setCopied(s.id); }}
                className="flex-1 rounded-full border border-line py-2.5 text-sm hover:border-ink/50">{copied === s.id ? "Lien copié ✓" : "Copier le lien"}</button>
            </div>
          </div>
        );
      })}
      <p className="mt-3 text-xs leading-relaxed text-muted">Google Agenda se met à jour tout seul, en général en quelques heures. Gardez ce lien pour vous : il donne accès à vos réservations.</p>
    </div>
  );
}
