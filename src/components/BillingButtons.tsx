"use client";

import { useState } from "react";

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

/** Ouvre le paiement Stripe de l'abonnement. */
export function SubscribeButton({ retour, label = "S'abonner · 29 €/mois" }: { retour?: string; label?: string }) {
  const { busy, error, go } = useRedirect("/api/abonnement/paiement", { retour });
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
        {busy ? "Ouverture…" : "Gérer mon abonnement"}
      </button>
      {error && <span role="alert" className="ml-2 text-sm text-red-400">{error}</span>}
    </>
  );
}
