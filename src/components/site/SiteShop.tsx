"use client";

import { useEffect, useMemo, useState } from "react";
import { tr, type Lang } from "@/lib/site/i18n";

/* Parties « boutique » des sites clients : compteur de visites, commande à emporter, carte cadeau. */

/** Compte une visite (une fois par session de navigation, aucune donnée personnelle). */
export function VisitBeacon({ slug }: { slug?: string }) {
  useEffect(() => {
    if (!slug || slug.startsWith("exemple-")) return;
    try {
      const k = `sc-visite-${slug}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* navigation privée : on compte quand même */ }
    const body = JSON.stringify({ slug });
    if (!navigator.sendBeacon?.("/api/visite", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/visite", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  }, [slug]);
  return null;
}

export type MenuItem = { key: string; cat: string; name: string; price: number };
const euro = (c: number) => `${(c / 100).toLocaleString("fr-FR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;

function useOpener(hash: string) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onClick = (e: Event) => {
      const a = (e.target as HTMLElement).closest(`a[href="${hash}"]`);
      if (!a) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    if (window.location.hash === hash) setOpen(true);
    return () => document.removeEventListener("click", onClick);
  }, [hash]);
  return [open, setOpen] as const;
}

/** Commande à emporter : le client choisit ses plats, l'heure de retrait, et paie sur place ou en ligne. */
export function OrderDialog({ slug, brand, items, online, lang, shop }: {
  slug?: string; brand: string; items: MenuItem[]; online: boolean; lang?: Lang;
  /** Mini-boutique : même fenêtre, ouverte par #boutique, avec retrait ou livraison. */
  shop?: { delivery: boolean; deliveryNote: string };
}) {
  const hash = shop ? "#boutique" : "#commander";
  const [open, setOpen] = useOpener(hash);
  const [delivery, setDelivery] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const en = lang === "en";
  const total = useMemo(() => items.reduce((s, i) => s + (qty[i.key] ?? 0) * i.price, 0), [items, qty]);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const cats = [...new Set(items.map((i) => i.cat))];

  useEffect(() => {
    const back = new URLSearchParams(window.location.search).get("commande");
    if (!back || window.location.hash !== hash) return;
    setOpen(true);
    if (back === "ok") setDone(en ? "Thank you! Your order is paid and sent." : `Merci ! Votre commande est payée et envoyée à ${brand}.`);
    else setError(en ? "Payment was cancelled. Your order was not sent." : "Le paiement a été annulé : la commande n'est pas partie. Vous pouvez réessayer.");
    window.history.replaceState(null, "", window.location.pathname + hash);
  }, [brand, en, setOpen, hash]);

  // Boutique : le bouton « Ajouter » d'un produit ouvre le panier avec ce produit.
  useEffect(() => {
    if (!shop) return;
    const add = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      setQty((q) => ({ ...q, [key]: Math.min(20, (q[key] ?? 0) + 1) }));
      setOpen(true);
    };
    window.addEventListener("siteclic:panier", add);
    return () => window.removeEventListener("siteclic:panier", add);
  }, [shop, setOpen]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!count) return setError(en ? "Choose at least one item." : shop ? "Choisissez au moins un produit." : "Choisissez au moins un plat.");
    const f = new FormData(e.currentTarget);
    const body = {
      slug, name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""), pickup: String(f.get("pickup") ?? ""),
      note: String(f.get("note") ?? ""), items: items.filter((i) => qty[i.key]).map((i) => ({ key: i.key, qty: qty[i.key] })),
      delivery: Boolean(shop && delivery), address: String(f.get("address") ?? ""),
    };
    setError("");
    if (!slug || slug.startsWith("exemple-")) return setDone(`Ceci est un aperçu : une fois le site en ligne, ${brand} recevra cette commande.`);
    setBusy(true);
    try {
      const res = await fetch("/api/commande", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "La commande n'est pas passée. Merci d'appeler directement.");
      if (typeof d.payUrl === "string" && d.payUrl.startsWith("https://")) { window.location.href = d.payUrl; return; }
      setDone(en ? "Thank you! Your order has been sent." : delivery
        ? `Merci ! Votre commande est envoyée. ${brand} vous appelle pour la livraison.`
        : `Merci ! Votre commande est envoyée. Vous payez sur place en la retirant chez ${brand}.`);
      setQty({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "La commande n'est pas passée.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="s-modal" role="dialog" aria-modal="true" aria-label={tr(lang, "Commander à emporter")} onClick={() => setOpen(false)}>
      <div className="s-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="s-modal-close" onClick={() => setOpen(false)} aria-label={tr(lang, "Fermer")}>×</button>
        {done ? (
          <div className="s-modal-done">
            <p className="s-display s-modal-title">{done}</p>
            <button type="button" className="s-btn" onClick={() => { setOpen(false); setDone(""); }}>{tr(lang, "Fermer")}</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="s-eyebrow">{shop ? (en ? "Shop" : "La boutique") : en ? "Takeaway" : "À emporter"}</p>
            <h2 className="s-display s-modal-title">{shop ? (en ? "Your basket" : "Votre panier") : tr(lang, "Commander à emporter")}</h2>
            <div className="s-order-list">
              {cats.map((c) => (
                <div key={c}>
                  <p className="s-order-cat">{c}</p>
                  {items.filter((i) => i.cat === c).map((i) => (
                    <div key={i.key} className={`s-order-item${qty[i.key] ? " on" : ""}`}>
                      <span className="s-order-name">{i.name}<small>{euro(i.price)}</small></span>
                      <span className="s-stepper s-stepper-sm">
                        <button type="button" onClick={() => setQty((q) => ({ ...q, [i.key]: Math.max(0, (q[i.key] ?? 0) - 1) }))} aria-label="Moins">−</button>
                        <output>{qty[i.key] ?? 0}</output>
                        <button type="button" onClick={() => setQty((q) => ({ ...q, [i.key]: Math.min(20, (q[i.key] ?? 0) + 1) }))} aria-label="Plus">+</button>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="s-field-row">
              <label className="s-field"><span>{tr(lang, "Nom")}</span><input name="name" autoComplete="name" required maxLength={80} /></label>
              <label className="s-field"><span>{tr(lang, "Téléphone")}</span><input name="phone" type="tel" autoComplete="tel" required minLength={6} maxLength={30} /></label>
            </div>
            {shop?.delivery && (
              <div className="s-seg" role="radiogroup" aria-label="Retrait ou livraison">
                <button type="button" role="radio" aria-checked={!delivery} className={!delivery ? "on" : ""} onClick={() => setDelivery(false)}>{en ? "Pickup" : "Retrait en boutique"}</button>
                <button type="button" role="radio" aria-checked={delivery} className={delivery ? "on" : ""} onClick={() => setDelivery(true)}>{en ? "Delivery" : "Livraison"}</button>
              </div>
            )}
            {delivery && (
              <label className="s-field"><span>{en ? "Delivery address" : "Adresse de livraison"}</span><input name="address" required minLength={8} maxLength={200} autoComplete="street-address" />
                {shop?.deliveryNote && <small className="s-modal-note">{shop.deliveryNote}</small>}</label>
            )}
            <label className="s-field"><span>{delivery ? (en ? "Preferred time" : "Heure souhaitée") : en ? "Pickup time" : "Heure de retrait"}</span><input name="pickup" type="time" required step={900} defaultValue={shop ? "17:00" : "12:30"} /></label>
            <label className="s-field"><span>{tr(lang, "Message")} <em>{tr(lang, "(facultatif)")}</em></span><textarea name="note" rows={2} maxLength={300} placeholder={en ? "Allergies, cutlery…" : "Allergies, couverts…"} /></label>
            {error && <p className="s-modal-error" role="alert">{error}</p>}
            <button className="s-btn s-btn-full" disabled={busy || !count}>
              {busy ? tr(lang, "Envoi…") : count ? `${online ? (en ? "Pay" : "Payer") : (en ? "Order" : "Commander")} · ${euro(total)}` : (en ? "Choose your items" : "Choisissez vos plats")}
            </button>
            <p className="s-modal-note">{online ? (en ? "Secure payment by Stripe." : "Paiement sécurisé par Stripe.") : (en ? "Pay when you pick up your order." : delivery ? "Vous payez à la livraison." : "Vous payez sur place, en retirant votre commande.")}</p>
          </form>
        )}
      </div>
    </div>
  );
}

/** Carte cadeau : montant, pour qui, petit mot ; paiement sécurisé Stripe. */
export function GiftDialog({ slug, brand, amounts, lang }: { slug?: string; brand: string; amounts: number[]; lang?: Lang }) {
  const [open, setOpen] = useOpener("#cadeau");
  const [amount, setAmount] = useState(amounts[1] ?? amounts[0] ?? 50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = lang === "en";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    if (!slug || slug.startsWith("exemple-")) return setError(`Ceci est un aperçu : une fois le site en ligne, le paiement s'ouvrira ici.`);
    setBusy(true);
    try {
      const res = await fetch("/api/cadeau", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, amount, buyer: String(f.get("buyer") ?? ""), recipient: String(f.get("recipient") ?? ""), message: String(f.get("message") ?? "") }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.payUrl !== "string") throw new Error(d.error || "Le paiement n'est pas disponible pour le moment.");
      window.location.href = d.payUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le paiement n'est pas disponible.");
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="s-modal" role="dialog" aria-modal="true" aria-label={tr(lang, "Offrir une carte cadeau")} onClick={() => setOpen(false)}>
      <div className="s-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="s-modal-close" onClick={() => setOpen(false)} aria-label={tr(lang, "Fermer")}>×</button>
        <form onSubmit={submit}>
          <p className="s-eyebrow">{en ? "Gift card" : "Carte cadeau"}</p>
          <h2 className="s-display s-modal-title">{en ? `A moment at ${brand}` : `Offrez un moment chez ${brand}`}</h2>
          <div className="s-gift-preview" aria-hidden>
            <span className="s-display">{brand}</span>
            <b className="s-display">{amount} €</b>
            <small>{en ? "Gift card" : "Carte cadeau"}</small>
          </div>
          <div className="s-gift-amounts" role="radiogroup">
            {amounts.map((a) => (
              <button key={a} type="button" role="radio" aria-checked={a === amount} className={a === amount ? "on" : ""} onClick={() => setAmount(a)}>{a} €</button>
            ))}
          </div>
          <div className="s-field-row">
            <label className="s-field"><span>{en ? "From" : "De la part de"}</span><input name="buyer" required maxLength={80} /></label>
            <label className="s-field"><span>{en ? "For" : "Pour"}</span><input name="recipient" required maxLength={80} /></label>
          </div>
          <label className="s-field"><span>{en ? "A few words" : "Un petit mot"} <em>{tr(lang, "(facultatif)")}</em></span><textarea name="message" rows={2} maxLength={300} /></label>
          {error && <p className="s-modal-error" role="alert">{error}</p>}
          <button className="s-btn s-btn-full" disabled={busy}>{busy ? tr(lang, "Envoi…") : `${en ? "Pay" : "Payer"} ${amount} €`}</button>
          <p className="s-modal-note">{en ? "Secure payment by Stripe. You receive the card right away, ready to print or share." : "Paiement sécurisé par Stripe. Vous recevez la carte tout de suite, à imprimer ou à envoyer."}</p>
        </form>
      </div>
    </div>
  );
}

/** Bouton « Ajouter au panier » d'un produit de la boutique. */
export function AddToBasket({ itemKey, label }: { itemKey: string; label: string }) {
  return (
    <button type="button" className="s-btn s-btn-sm" onClick={() => window.dispatchEvent(new CustomEvent("siteclic:panier", { detail: itemKey }))}>
      {label}
    </button>
  );
}
