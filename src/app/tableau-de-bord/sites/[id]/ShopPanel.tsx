"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { priceCents, type SiteContent } from "@/lib/site/schema";

/* Statistiques, QR code, avis Google, commande à emporter, cartes cadeaux, site en anglais. */

type Save = (body: object, ok: string) => Promise<void>;
type Stats = { ready: boolean; days?: { day: string; visits: number }[]; reservations?: number; orders?: number };

export function ShopPanel({ id, content, busy, save, onTranslated }: {
  id: string; content: SiteContent; busy: boolean; save: Save; onTranslated: (c: SiteContent) => void;
}) {
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/paiements").then((r) => r.json()).then((s) => setStripeReady(Boolean(s?.enabled && s?.ready))).catch(() => setStripeReady(false));
  }, []);

  return (
    <>
      <StatsCard id={id} />
      <QrCard id={id} />
      <ReviewsCard content={content} busy={busy} save={save} />
      <OrderCard content={content} busy={busy} save={save} stripeReady={stripeReady} />
      <GiftCard content={content} busy={busy} save={save} stripeReady={stripeReady} />
      <EnglishCard id={id} content={content} busy={busy} onTranslated={onTranslated} />
    </>
  );
}

function Card({ title, text, children, right }: { title: string; text?: string; children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
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

function Toggle({ on, label, disabled, onClick }: { on: boolean; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-clic" : "bg-white/15"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

function StatsCard({ id }: { id: string }) {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    fetch(`/api/sites/${id}/stats`).then((r) => r.json()).then(setS).catch(() => setS({ ready: false }));
  }, [id]);
  const days = s?.days ?? [];
  const total = days.reduce((a, d) => a + d.visits, 0);
  const week = days.slice(-7).reduce((a, d) => a + d.visits, 0);
  const max = Math.max(1, ...days.map((d) => d.visits));
  return (
    <Card title="Statistiques" text="Les visites de votre site sur les 30 derniers jours.">
      {!s ? <p className="mt-3 text-xs text-muted">Chargement…</p> : !s.ready ? (
        <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Les statistiques démarrent dès que le code SQL n°13 est ajouté dans Supabase.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[[total, "visites (30 j)"], [week, "cette semaine"], [s.reservations ?? 0, "réservations"]].map(([n, l]) => (
              <div key={l as string} className="rounded-xl bg-cream px-2 py-3">
                <p className="text-2xl font-semibold tabular-nums">{n}</p>
                <p className="mt-0.5 text-[11px] text-muted">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-24 items-end gap-[3px]" role="img" aria-label={`${total} visites en 30 jours`}>
            {days.map((d) => (
              <div key={d.day} title={`${d.day.slice(8, 10)}/${d.day.slice(5, 7)} : ${d.visits}`}
                className="flex-1 rounded-t-sm bg-clic/80" style={{ height: `${Math.max(3, (d.visits / max) * 100)}%`, opacity: d.visits ? 1 : 0.25 }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted"><span>il y a 30 jours</span><span>aujourd&apos;hui</span></div>
          {(s.orders ?? 0) > 0 && <p className="mt-2 text-xs text-muted">{s.orders} commande{s.orders! > 1 ? "s" : ""} à emporter ce mois-ci.</p>}
        </>
      )}
    </Card>
  );
}

function QrCard({ id }: { id: string }) {
  return (
    <Card title="QR code de la carte" text="À imprimer et poser sur les tables ou en vitrine : on scanne et on voit votre carte et le menu du jour, toujours à jour.">
      <Link href={`/tableau-de-bord/sites/${id}/qr`} className="mt-3 block w-full rounded-full bg-clic py-2.5 text-center text-sm font-medium text-white">
        Voir et imprimer mon QR code
      </Link>
    </Card>
  );
}

function ReviewsCard({ content, busy, save }: { content: SiteContent; busy: boolean; save: Save }) {
  const r = content.reviews ?? { googleUrl: "", items: [] };
  const [url, setUrl] = useState(r.googleUrl);
  const [items, setItems] = useState(r.items);
  const [draft, setDraft] = useState({ name: "", text: "", stars: 5 });
  const dirty = url !== r.googleUrl || JSON.stringify(items) !== JSON.stringify(r.items);
  const urlOk = !url || /^https:\/\/\S+$/.test(url);
  return (
    <Card title="Avis Google" text="Affichez vos plus beaux avis sur votre site, avec un bouton « Laisser un avis Google ». Depuis vos réservations, vous pouvez aussi demander un avis à vos clients en un geste.">
      <label className="mt-3 block text-xs text-muted" htmlFor="g-url">Lien pour laisser un avis (Google Business → « Demander des avis » → copier le lien)</label>
      <input id="g-url" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://g.page/r/…/review"
        className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[15px] outline-none focus:border-ink/60" />
      {!urlOk && <p className="mt-1 text-xs text-red-400">Le lien doit commencer par https://</p>}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((it, k) => (
            <li key={k} className="flex items-start gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
              <div className="flex-1">
                <p className="text-clic">{"★".repeat(it.stars)}<span className="text-white/20">{"★".repeat(5 - it.stars)}</span></p>
                <p className="mt-0.5 leading-snug">« {it.text} »</p>
                <p className="mt-0.5 text-xs text-muted">{it.name}</p>
              </div>
              <button type="button" aria-label="Retirer cet avis" onClick={() => setItems(items.filter((_, j) => j !== k))} className="text-muted">✕</button>
            </li>
          ))}
        </ul>
      )}
      {items.length < 12 && (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed border-line p-3">
          <p className="text-xs text-muted">Recopiez un avis reçu sur Google :</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Étoiles">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={draft.stars === n} aria-label={`${n} étoiles`}
                onClick={() => setDraft({ ...draft, stars: n })} className={`text-2xl leading-none ${n <= draft.stars ? "text-clic" : "text-white/20"}`}>★</button>
            ))}
          </div>
          <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={2} maxLength={400} placeholder="Texte de l'avis"
            className="w-full resize-y rounded-xl border border-line bg-cream px-3 py-2 text-[15px] outline-none focus:border-ink/60" />
          <div className="flex gap-2">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} placeholder="Prénom (ex. Julie M.)"
              className="min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 py-2 text-[15px] outline-none focus:border-ink/60" />
            <button type="button" disabled={!draft.text.trim() || !draft.name.trim()}
              onClick={() => { setItems([...items, { name: draft.name.trim(), text: draft.text.trim(), stars: draft.stars }]); setDraft({ name: "", text: "", stars: 5 }); }}
              className="rounded-full border border-line px-4 text-sm disabled:opacity-40">Ajouter</button>
          </div>
        </div>
      )}
      <button type="button" disabled={busy || !dirty || !urlOk}
        onClick={() => save({ reviews: { googleUrl: url, items } }, "Avis en ligne ✓")}
        className="mt-3 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">Enregistrer les avis</button>
    </Card>
  );
}

function StripeNote({ ready }: { ready: boolean | null }) {
  if (ready !== false) return null;
  return (
    <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
      Le paiement en ligne s&apos;active dès que votre compte de paiement est prêt (carte « Garantir les réservations », bouton « Activer les paiements »).
    </p>
  );
}

function OrderCard({ content, busy, save, stripeReady }: { content: SiteContent; busy: boolean; save: Save; stripeReady: boolean | null }) {
  const o = content.order ?? { enabled: false, online: false };
  const priced = content.offer.categories.reduce((n, c) => n + c.items.filter((i) => priceCents(i.price)).length, 0);
  return (
    <Card title="Commande à emporter" text="Un bouton « Commander à emporter » sur votre site : le client choisit ses plats et son heure de retrait. Les commandes arrivent dans « Commandes ». 2 % seulement si le client paie en ligne."
      right={<Toggle on={o.enabled} label="Commande à emporter" disabled={busy}
        onClick={() => save({ order: { enabled: !o.enabled, online: o.online } }, o.enabled ? "Commande à emporter retirée." : "Commande à emporter activée ✓")} />}>
      {o.enabled && (
        <>
          {priced === 0 && <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Ajoutez des prix à votre carte (ex. « 12 € ») pour que vos plats puissent être commandés.</p>}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-line p-1 text-xs">
            {([[false, "Payé sur place"], [true, "Payé en ligne"]] as const).map(([v, label]) => (
              <button key={label} type="button" disabled={busy} onClick={() => v !== o.online && save({ order: { enabled: true, online: v } }, v ? "Paiement en ligne choisi ✓" : "Paiement sur place choisi ✓")}
                className={`rounded-full py-2 ${o.online === v ? "bg-clic text-white" : "text-muted"}`}>{label}</button>
            ))}
          </div>
          {o.online && <StripeNote ready={stripeReady} />}
          <Link href="/tableau-de-bord/commandes" className="mt-3 inline-block text-sm text-clic underline underline-offset-4">Voir mes commandes →</Link>
        </>
      )}
    </Card>
  );
}

function GiftCard({ content, busy, save, stripeReady }: { content: SiteContent; busy: boolean; save: Save; stripeReady: boolean | null }) {
  const g = content.gift ?? { enabled: false, amounts: [30, 50, 100] };
  const [amounts, setAmounts] = useState(g.amounts);
  const [extra, setExtra] = useState("");
  const dirty = JSON.stringify(amounts) !== JSON.stringify(g.amounts);
  return (
    <Card title="Cartes cadeaux" text="Vos clients achètent une carte cadeau sur votre site et l'offrent tout de suite (code unique, prête à imprimer). Vous recevez l'argent, SiteClic garde 2 %."
      right={<Toggle on={g.enabled} label="Cartes cadeaux" disabled={busy}
        onClick={() => save({ gift: { enabled: !g.enabled, amounts } }, g.enabled ? "Cartes cadeaux retirées." : "Cartes cadeaux activées ✓")} />}>
      {g.enabled && (
        <>
          <p className="mt-3 text-xs text-muted">Montants proposés :</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {amounts.map((a) => (
              <button key={a} type="button" onClick={() => amounts.length > 1 && setAmounts(amounts.filter((x) => x !== a))}
                className="rounded-full border border-clic/50 bg-clic/10 px-3 py-1.5 text-sm">{a} € <span className="text-muted">✕</span></button>
            ))}
            {amounts.length < 5 && (
              <span className="flex items-center gap-1">
                <input value={extra} onChange={(e) => setExtra(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="75" aria-label="Autre montant"
                  className="w-16 rounded-full border border-line bg-cream px-3 py-1.5 text-sm outline-none" />
                <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm"
                  onClick={() => { const n = Number(extra); if (n >= 10 && n <= 500 && !amounts.includes(n)) setAmounts([...amounts, n].sort((a, b) => a - b)); setExtra(""); }}>+</button>
              </span>
            )}
          </div>
          {dirty && (
            <button type="button" disabled={busy} onClick={() => save({ gift: { enabled: true, amounts } }, "Montants enregistrés ✓")}
              className="mt-3 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">Enregistrer les montants</button>
          )}
          <StripeNote ready={stripeReady} />
          <Link href="/tableau-de-bord/commandes" className="mt-3 inline-block text-sm text-clic underline underline-offset-4">Voir les cartes vendues →</Link>
        </>
      )}
    </Card>
  );
}

function EnglishCard({ id, content, busy, onTranslated }: { id: string; content: SiteContent; busy: boolean; onTranslated: (c: SiteContent) => void }) {
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  const done = content.translations?.enAt;
  async function go() {
    setWorking(true);
    setMsg("Traduction en cours… (environ 30 secondes)");
    const res = await fetch(`/api/sites/${id}/traduire`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.content) { onTranslated(d.content); setMsg("Votre site existe maintenant en anglais ✓ Bouton « EN » en haut du site."); }
    else setMsg(d?.error || "La traduction a échoué. Réessayez.");
    setWorking(false);
  }
  return (
    <Card title="Mon site en anglais" text="Un bouton « EN » en haut de votre site pour les touristes. Traduit une fois par l'IA, en anglais soigné. Après une grosse modification, retraduisez en un geste.">
      {done && <p className="mt-2 text-xs text-emerald-300">Traduit le {new Date(done).toLocaleDateString("fr-FR")}</p>}
      <button type="button" disabled={busy || working} onClick={go}
        className="mt-3 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">
        {working ? "Traduction…" : done ? "Retraduire mon site" : "Traduire mon site en anglais"}
      </button>
      {msg && <p className="mt-2 text-xs text-muted" role="status">{msg}</p>}
    </Card>
  );
}
