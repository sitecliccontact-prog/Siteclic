"use client";

import { useState } from "react";
import { celebrate } from "@/components/Celebration";

export type Resa = {
  id: string; site_id: string; site: string; name: string; phone: string; day: string; time: string;
  people: number; message: string; status: "nouvelle" | "confirmee" | "refusee"; created_at: string;
};

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const tel = (p: string) => p.replace(/[^\d+]/g, "");

export function Board({ initial, multiSite }: { initial: Resa[]; multiSite: boolean }) {
  const [list, setList] = useState(initial);
  const [err, setErr] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

  async function setStatus(r: Resa, status: Resa["status"]) {
    setErr("");
    setList((l) => l.map((x) => (x.id === r.id ? { ...x, status } : x)));
    const res = await fetch(`/api/reservations/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    if (!res?.ok) {
      setErr("La modification n'est pas passée. Réessayez.");
      setList((l) => l.map((x) => (x.id === r.id ? r : x)));
    } else if (status === "confirmee") {
      celebrate("Réservation confirmée");
    }
  }
  async function remove(r: Resa) {
    setList((l) => l.filter((x) => x.id !== r.id));
    const res = await fetch(`/api/reservations/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setErr("Suppression impossible."); setList((l) => [...l, r]); }
  }

  const upcoming = list.filter((r) => r.day >= today && r.status !== "refusee");
  const todo = upcoming.filter((r) => r.status === "nouvelle");
  const confirmed = upcoming.filter((r) => r.status === "confirmee");
  const past = list.filter((r) => r.day < today || r.status === "refusee").reverse();

  return (
    <div className="mt-8 space-y-10">
      <div className="grid grid-cols-3 gap-3">
        <Stat n={todo.length} label="à traiter" hot />
        <Stat n={confirmed.length} label="confirmées" />
        <Stat n={confirmed.filter((r) => r.day === today).reduce((s, r) => s + r.people, 0)} label="couverts ce jour" />
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <Group title="À traiter" empty="Aucune nouvelle demande. Elles arrivent ici dès qu'un client réserve." items={todo} multiSite={multiSite} onStatus={setStatus} onRemove={remove} />
      <Group title="Confirmées" empty="Aucune réservation confirmée à venir." items={confirmed} multiSite={multiSite} onStatus={setStatus} onRemove={remove} />
      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-muted">Passées et refusées ({past.length}) <span className="text-clic">+</span></summary>
          <div className="mt-4"><Group title="" empty="" items={past} multiSite={multiSite} onStatus={setStatus} onRemove={remove} faded /></div>
        </details>
      )}
    </div>
  );
}

function Stat({ n, label, hot }: { n: number; label: string; hot?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${hot && n ? "border-clic/50 bg-clic/10" : "border-line bg-card"}`}>
      <p className={`font-display text-3xl font-semibold ${hot && n ? "text-clic" : ""}`}>{n}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

type GroupProps = { title: string; empty: string; items: Resa[]; multiSite: boolean; faded?: boolean; onStatus: (r: Resa, s: Resa["status"]) => void; onRemove: (r: Resa) => void };

function Group({ title, empty, items, multiSite, faded, onStatus, onRemove }: GroupProps) {
  const days = [...new Set(items.map((r) => r.day))];
  return (
    <div>
      {title && <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{title}</h2>}
      {!items.length && empty && <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">{empty}</p>}
      {days.map((d) => (
        <div key={d} className="mt-4">
          <p className="mb-2 font-display text-lg font-semibold first-letter:uppercase">{fmtDay(d)}</p>
          <ul className={`space-y-2 ${faded ? "opacity-60" : ""}`}>
            {items.filter((r) => r.day === d).map((r) => <Card key={r.id} r={r} multiSite={multiSite} onStatus={onStatus} onRemove={onRemove} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Card({ r, multiSite, onStatus, onRemove }: { r: Resa; multiSite: boolean; onStatus: GroupProps["onStatus"]; onRemove: GroupProps["onRemove"] }) {
  const sms = `Bonjour ${r.name.split(" ")[0]}, votre réservation du ${fmtDay(r.day)} à ${r.time.replace(":", "h")} pour ${r.people} ${r.people > 1 ? "personnes" : "personne"}${r.site ? ` chez ${r.site}` : ""} est confirmée. À bientôt !`;
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-center">
          <span className="font-display text-lg font-semibold leading-none">{r.time.replace(":", "h")}</span>
          <span className="text-[11px] text-muted">{r.people} pers.</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{r.name}</p>
          <a href={`tel:${tel(r.phone)}`} className="text-sm text-muted underline-offset-4 hover:underline">{r.phone}</a>
          {(r.message || (multiSite && r.site)) && (
            <p className="mt-1 text-sm text-ink/70">{[multiSite ? r.site : "", r.message].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {r.status === "confirmee" && <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">Confirmée</span>}
        {r.status === "refusee" && <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs text-muted">Refusée</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {r.status === "nouvelle" && (
          <>
            <button onClick={() => onStatus(r, "confirmee")} className="rounded-full bg-clic px-4 py-2 font-medium text-white">Confirmer</button>
            <button onClick={() => onStatus(r, "refusee")} className="rounded-full border border-line px-4 py-2">Refuser</button>
          </>
        )}
        {r.status === "confirmee" && (
          <a href={`sms:${tel(r.phone)}?&body=${encodeURIComponent(sms)}`} className="rounded-full bg-emerald-500/90 px-4 py-2 font-medium text-white">Prévenir par SMS</a>
        )}
        <a href={`tel:${tel(r.phone)}`} className="rounded-full border border-line px-4 py-2">Appeler</a>
        {r.status !== "nouvelle" && <button onClick={() => onRemove(r)} className="ml-auto px-2 py-2 text-muted hover:text-red-400">Supprimer</button>}
      </div>
    </li>
  );
}
