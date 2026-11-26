"use client";

import { useState } from "react";
import { celebrate } from "@/components/Celebration";

export type Order = {
  id: string; site: string; name: string; phone: string; pickup: string; items: { name: string; qty: number; price: number }[];
  total: number; note: string; status: "nouvelle" | "prete" | "retiree" | "annulee"; created_at: string; online: boolean; paid: boolean;
};
export type Gift = { id: string; site: string; code: string; amount: number; buyer: string; recipient: string; created_at: string; used: boolean; paid: boolean };

const euros = (c: number) => `${(c / 100).toLocaleString("fr-FR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const tel = (p: string) => p.replace(/[^\d+]/g, "");
const when = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));

export function OrdersBoard({ orders, gifts, multiSite }: { orders: Order[]; gifts: Gift[]; multiSite: boolean }) {
  const [list, setList] = useState(orders);
  const [cards, setCards] = useState(gifts);
  const [err, setErr] = useState("");

  async function setStatus(o: Order, status: Order["status"]) {
    setErr("");
    setList((l) => l.map((x) => (x.id === o.id ? { ...x, status } : x)));
    const res = await fetch(`/api/commandes/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    if (!res?.ok) { setErr("La modification n'est pas passée. Réessayez."); setList((l) => l.map((x) => (x.id === o.id ? o : x))); }
    else if (status === "retiree") celebrate("Commande remise");
  }
  async function setUsed(g: Gift, used: boolean) {
    setCards((l) => l.map((x) => (x.id === g.id ? { ...x, used } : x)));
    const res = await fetch(`/api/cartes-cadeaux/${g.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ used }) }).catch(() => null);
    if (!res?.ok) { setErr("La modification n'est pas passée. Réessayez."); setCards((l) => l.map((x) => (x.id === g.id ? g : x))); }
  }

  const active = list.filter((o) => o.status === "nouvelle" || o.status === "prete");
  const done = list.filter((o) => o.status === "retiree" || o.status === "annulee");
  const todayTotal = list.filter((o) => o.status !== "annulee" && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((s, o) => s + o.total, 0);

  return (
    <div className="mt-8 space-y-10">
      <div className="grid grid-cols-3 gap-3">
        <Stat n={String(active.filter((o) => o.status === "nouvelle").length)} label="à préparer" hot />
        <Stat n={euros(todayTotal)} label="aujourd'hui" />
        <Stat n={String(cards.filter((g) => !g.used).length)} label="cartes cadeaux" />
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}

      <div>
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">À préparer</h2>
        {!active.length && <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">Aucune commande en cours. Elles arrivent ici dès qu&apos;un client commande sur votre site.</p>}
        <ul className="mt-3 space-y-2">{active.map((o) => <OrderCard key={o.id} o={o} multiSite={multiSite} onStatus={setStatus} />)}</ul>
      </div>

      <div>
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Cartes cadeaux vendues</h2>
        {!cards.length && <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">Aucune carte cadeau pour le moment.</p>}
        <ul className="mt-3 space-y-2">
          {cards.map((g) => (
            <li key={g.id} className={`flex items-center gap-4 rounded-2xl border border-line bg-card p-4 ${g.used ? "opacity-60" : ""}`}>
              <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-clic/15 font-display text-lg font-semibold text-clic">{euros(g.amount)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-mono tracking-[0.15em]">{g.code}</p>
                <p className="text-sm text-muted">Pour {g.recipient || "—"} · de {g.buyer || "—"}{multiSite && g.site ? ` · ${g.site}` : ""}</p>
                <p className="text-xs text-muted/70">Achetée le {when(g.created_at)} · payée ✓</p>
              </div>
              <button onClick={() => setUsed(g, !g.used)} className={`shrink-0 rounded-full px-4 py-2 text-sm ${g.used ? "border border-line text-muted" : "bg-clic font-medium text-white"}`}>
                {g.used ? "Utilisée ✓" : "Marquer utilisée"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-muted">Remises et annulées ({done.length}) <span className="text-clic">+</span></summary>
          <ul className="mt-4 space-y-2 opacity-60">{done.map((o) => <OrderCard key={o.id} o={o} multiSite={multiSite} onStatus={setStatus} />)}</ul>
        </details>
      )}
    </div>
  );
}

function Stat({ n, label, hot }: { n: string; label: string; hot?: boolean }) {
  const on = hot && n !== "0";
  return (
    <div className={`rounded-2xl border p-4 ${on ? "border-clic/50 bg-clic/10" : "border-line bg-card"}`}>
      <p className={`font-display text-2xl font-semibold sm:text-3xl ${on ? "text-clic" : ""}`}>{n}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function OrderCard({ o, multiSite, onStatus }: { o: Order; multiSite: boolean; onStatus: (o: Order, s: Order["status"]) => void }) {
  const ready = `Bonjour ${o.name.trim().split(" ")[0]}, votre commande${o.site ? ` chez ${o.site}` : ""} est prête ! Vous pouvez venir la chercher. À tout de suite.`;
  return (
    <li className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-center">
          <span className="font-display text-lg font-semibold leading-none">{o.pickup.replace(":", "h")}</span>
          <span className="text-[11px] text-muted">retrait</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{o.name}</p>
          <a href={`tel:${tel(o.phone)}`} className="text-sm text-muted underline-offset-4 hover:underline">{o.phone}</a>
          <ul className="mt-2 space-y-0.5 text-sm">
            {o.items.map((it, k) => <li key={k}><span className="text-clic">{it.qty}×</span> {it.name}</li>)}
          </ul>
          {o.note && <p className="mt-1 text-sm italic text-ink/70">« {o.note} »</p>}
          <p className="mt-2 text-sm">
            <span className="font-semibold">{euros(o.total)}</span>
            {o.paid ? <span className="ml-2 rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">Payée en ligne ✓</span>
              : <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted">{o.online ? "Paiement non terminé : à régler sur place" : "À régler sur place"}</span>}
            {multiSite && o.site && <span className="ml-2 text-xs text-muted">{o.site}</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {o.status === "nouvelle" && (
          <>
            <button onClick={() => onStatus(o, "prete")} className="rounded-full bg-clic px-4 py-2 font-medium text-white">C&apos;est prêt</button>
            <button onClick={() => onStatus(o, "annulee")} className="rounded-full border border-line px-4 py-2">Annuler</button>
          </>
        )}
        {o.status === "prete" && (
          <>
            <a href={`sms:${tel(o.phone)}?&body=${encodeURIComponent(ready)}`} className="rounded-full bg-emerald-500/90 px-4 py-2 font-medium text-white">Prévenir par SMS</a>
            <button onClick={() => onStatus(o, "retiree")} className="rounded-full border border-line px-4 py-2">Remise au client</button>
          </>
        )}
        {(o.status === "retiree" || o.status === "annulee") && <span className="px-1 py-2 text-muted">{o.status === "retiree" ? "Remise ✓" : "Annulée"}</span>}
        <a href={`tel:${tel(o.phone)}`} className="rounded-full border border-line px-4 py-2">Appeler</a>
      </div>
    </li>
  );
}
