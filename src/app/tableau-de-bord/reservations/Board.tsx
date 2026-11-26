"use client";

import { useState } from "react";
import { celebrate } from "@/components/Celebration";

export type Resa = {
  id: string; site_id: string; site: string; name: string; phone: string; day: string; time: string;
  people: number; message: string; status: "nouvelle" | "confirmee" | "refusee"; created_at: string; table_label?: string;
  pay_mode?: string; pay_amount?: number; pay_charged?: number; review?: string;
};

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const tel = (p: string) => p.replace(/[^\d+]/g, "");
const parisDay = (offset = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + offset * 86400000));
const first = (n: string) => n.trim().split(" ")[0];
const smsLink = (phone: string, body: string) => `sms:${tel(phone)}?&body=${encodeURIComponent(body)}`;

export function Board({ initial, multiSite }: { initial: Resa[]; multiSite: boolean }) {
  const [list, setList] = useState(initial);
  const [err, setErr] = useState("");
  const today = parisDay();
  const tomorrow = parisDay(1);

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
  const reminders = confirmed.filter((r) => r.day === tomorrow);

  return (
    <div className="mt-8 space-y-10">
      <div className="grid grid-cols-3 gap-3">
        <Stat n={todo.length} label="à traiter" hot />
        <Stat n={confirmed.length} label="confirmées" />
        <Stat n={confirmed.filter((r) => r.day === today).reduce((s, r) => s + r.people, 0)} label="couverts ce jour" />
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {reminders.length > 0 && (
        <div className="rounded-2xl border border-clic/40 bg-clic/5 p-4">
          <p className="font-medium">🔔 Rappels pour demain ({reminders.length})</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">Un petit SMS la veille, et presque plus aucune table vide. Touchez chaque nom : le message est déjà écrit.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {reminders.map((r) => (
              <a key={r.id} href={smsLink(r.phone, reminderText(r))} className="rounded-full bg-clic px-4 py-2 text-sm font-medium text-white">
                {r.time.replace(":", "h")} · {first(r.name)}
              </a>
            ))}
          </div>
        </div>
      )}
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

function reminderText(r: Resa) {
  return `Bonjour ${first(r.name)}, petit rappel : nous vous attendons demain à ${r.time.replace(":", "h")} pour ${r.people} ${r.people > 1 ? "personnes" : "personne"}${r.site ? ` chez ${r.site}` : ""}. En cas d'empêchement, merci de nous prévenir. À demain !`;
}

function reviewText(r: Resa) {
  return `Bonjour ${first(r.name)}, merci d'être venu${r.site ? ` chez ${r.site}` : ""} ! Si vous avez passé un bon moment, un petit avis nous aiderait beaucoup : ${r.review} Merci et à bientôt !`;
}

function Card({ r, multiSite, onStatus, onRemove }: { r: Resa; multiSite: boolean; onStatus: GroupProps["onStatus"]; onRemove: GroupProps["onRemove"] }) {
  const today = parisDay();
  const sms = `Bonjour ${first(r.name)}, votre réservation du ${fmtDay(r.day)} à ${r.time.replace(":", "h")} pour ${r.people} ${r.people > 1 ? "personnes" : "personne"}${r.table_label ? ` (table ${r.table_label})` : ""}${r.site ? ` chez ${r.site}` : ""} est confirmée. À bientôt !`;
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-center">
          <span className="font-display text-lg font-semibold leading-none">{r.time.replace(":", "h")}</span>
          <span className="text-[11px] text-muted">{r.people} pers.</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{r.name}{r.table_label && <span className="ml-2 rounded-full bg-clic/15 px-2 py-0.5 text-xs text-clic">Table {r.table_label}</span>}</p>
          <a href={`tel:${tel(r.phone)}`} className="text-sm text-muted underline-offset-4 hover:underline">{r.phone}</a>
          {r.pay_mode === "empreinte" && (
            <p className="mt-1 text-xs text-emerald-300">🔒 Garantie par carte{r.pay_charged ? ` · absence facturée ${euros(r.pay_charged)}` : ""}</p>
          )}
          {r.pay_mode === "acompte" && <p className="mt-1 text-xs text-emerald-300">🔒 Acompte de {euros(r.pay_amount ?? 0)} demandé</p>}
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
        {r.status === "confirmee" && r.day >= today && (
          <a href={smsLink(r.phone, sms)} className="rounded-full bg-emerald-500/90 px-4 py-2 font-medium text-white">Prévenir par SMS</a>
        )}
        {r.status === "confirmee" && r.day === parisDay(1) && (
          <a href={smsLink(r.phone, reminderText(r))} className="rounded-full border border-clic/60 px-4 py-2 text-clic">Rappel de demain</a>
        )}
        {r.status === "confirmee" && r.day < today && r.review && (
          <a href={smsLink(r.phone, reviewText(r))} className="rounded-full bg-clic px-4 py-2 font-medium text-white">★ Demander un avis</a>
        )}
        <a href={`tel:${tel(r.phone)}`} className="rounded-full border border-line px-4 py-2">Appeler</a>
        {r.pay_mode === "empreinte" && !r.pay_charged && r.status !== "refusee" && <NoShow r={r} />}
        {r.status !== "nouvelle" && <button onClick={() => onRemove(r)} className="ml-auto px-2 py-2 text-muted hover:text-red-400">Supprimer</button>}
      </div>
    </li>
  );
}

const euros = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

/** Le client n'est pas venu : prélever le montant prévu sur sa carte (2 étapes pour éviter une erreur). */
function NoShow({ r }: { r: Resa }) {
  const [step, setStep] = useState<"idle" | "ask" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");
  async function charge() {
    setStep("busy");
    setMsg("");
    const res = await fetch(`/api/reservations/${r.id}/absence`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok) { setStep("done"); setMsg(`${euros(d.amount)} prélevés ✓`); celebrate("Absence facturée"); }
    else { setStep("idle"); setMsg(d?.error || "Le prélèvement n'a pas pu être fait."); }
  }
  if (step === "done") return <span className="rounded-full bg-emerald-400/10 px-4 py-2 text-emerald-300">{msg}</span>;
  return (
    <>
      {step === "idle" && <button onClick={() => setStep("ask")} className="rounded-full border border-red-400/50 px-4 py-2 text-red-300">Client absent ?</button>}
      {step !== "idle" && (
        <button onClick={charge} disabled={step === "busy"} className="rounded-full bg-red-500 px-4 py-2 font-medium text-white disabled:opacity-60">
          {step === "busy" ? "Prélèvement…" : "Oui, facturer l'absence"}
        </button>
      )}
      {step === "ask" && <button onClick={() => setStep("idle")} className="px-2 py-2 text-muted">Annuler</button>}
      {msg && <span className="w-full text-xs text-red-400">{msg}</span>}
    </>
  );
}
