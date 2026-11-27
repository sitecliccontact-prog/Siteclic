"use client";

import { useState } from "react";
import { HOSTING, OFFERS, type OfferId } from "@/lib/pricing";

function useRedirect(endpoint: string, body?: object) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true);
    setError("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok && data?.url) {
      window.location.href = data.url;
      return;
    }
    setError(data?.error || "Une erreur est survenue. Réessayez dans un instant.");
    setBusy(false);
  }
  return { busy, error, go };
}

/** Choix de l'offre et de l'hébergement, puis paiement Stripe. */
export function PlanPicker({ retour }: { retour?: string }) {
  const [offer, setOffer] = useState<OfferId>("site");
  const [hosting, setHosting] = useState<"an" | "mois">("an");
  const total = OFFERS.find((o) => o.id === offer)?.price ?? "";
  const pill = (on: boolean) =>
    `flex-1 rounded-2xl border px-4 py-3 text-left transition ${on ? "border-clic bg-clic/10" : "border-line bg-card hover:border-ink/30"}`;
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Votre formule</legend>
        <div className="flex gap-2">
          {OFFERS.map((o) => (
            <button key={o.id} type="button" aria-pressed={offer === o.id} onClick={() => setOffer(o.id)} className={pill(offer === o.id)}>
              <span className="block text-sm font-medium">{o.name}</span>
              <span className="font-display text-xl font-semibold">{o.price}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Hébergement</legend>
        <div className="flex gap-2">
          <button type="button" aria-pressed={hosting === "an"} onClick={() => setHosting("an")} className={pill(hosting === "an")}>
            <span className="block text-sm font-medium">À l&apos;année</span>
            <span className="font-display text-xl font-semibold">{HOSTING.year}</span>
            <span className="block text-xs text-muted">une fois par an</span>
          </button>
          <button type="button" aria-pressed={hosting === "mois"} onClick={() => setHosting("mois")} className={pill(hosting === "mois")}>
            <span className="block text-sm font-medium">Au mois</span>
            <span className="font-display text-xl font-semibold">{HOSTING.month}</span>
            <span className="block text-xs text-muted">sans engagement</span>
          </button>
        </div>
      </fieldset>
      <SubscribeButton retour={retour} offer={offer} hosting={hosting}
        label={`Payer ${total} + hébergement`} />
    </div>
  );
}

/** Ouvre le paiement Stripe (site + hébergement). */
export function SubscribeButton({ retour, offer = "site", hosting = "an", label = "Payer et mettre en ligne" }: { retour?: string; offer?: OfferId; hosting?: "an" | "mois"; label?: string }) {
  const { busy, error, go } = useRedirect("/api/abonnement/paiement", { retour, offer, hosting });
  return (
    <div>
      <button onClick={go} disabled={busy}
        className="w-full rounded-full bg-clic px-6 py-4 text-base font-semibold text-white transition hover:bg-clic-dark disabled:opacity-60">
        {busy ? "Ouverture du paiement…" : label}
      </button>
      {error && <p role="alert" className="mt-3 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

/** Ouvre l'espace Stripe pour gérer ou résilier l'abonnement. */
export function ManageButton({ className = "" }: { className?: string }) {
  const { busy, error, go } = useRedirect("/api/abonnement/gerer");
  return (
    <>
      <button onClick={go} disabled={busy} className={className || "underline underline-offset-4"}>
        {busy ? "Ouverture…" : "Gérer mon hébergement"}
      </button>
      {error && <span role="alert" className="ml-2 text-sm text-red-400">{error}</span>}
    </>
  );
}
