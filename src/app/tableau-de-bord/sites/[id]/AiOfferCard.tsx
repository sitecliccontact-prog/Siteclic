"use client";

import { useEffect, useState } from "react";
import { AI_PLANS } from "@/lib/pricing";

type Offer = { ready: boolean; plan: string | null; quota: number; used: number };

/** Option payante « Assistant IA de réservation » (Essentiel / Pro), avec les conversations du mois. */
export function AiOfferCard({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [asked, setAsked] = useState("");

  useEffect(() => {
    fetch(`/api/sites/${id}/offre-ia`).then((r) => r.json()).then(setOffer).catch(() => setOffer(null));
  }, [id]);

  const active = offer && offer.quota > 0;
  const team = offer && offer.quota >= 100000;
  const name = AI_PLANS.find((p) => p.id === offer?.plan)?.name;
  const pct = active && !team ? Math.min(100, Math.round((offer.used / offer.quota) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-clic/40 bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[.2em] text-clic">Option</p>
      <p className="mt-1 font-medium">Assistant IA de réservation</p>

      {active ? (
        <>
          <p className="mt-1 text-sm text-muted">
            {team ? "Compte SiteClic : illimité (tests)." : `Formule ${name ?? ""} active : ${offer.used} / ${offer.quota} conversations ce mois-ci.`}
          </p>
          {!team && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-clic transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          {!team && pct >= 100 && (
            <p className="mt-2 text-xs text-amber-200">Limite du mois atteinte : vos clients réservent avec le formulaire jusqu&apos;au 1er du mois prochain.</p>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Vos clients réservent en parlant à un assistant qui connaît votre carte, vos horaires et vos tables, même la nuit.
          Sans l&apos;option, votre site garde la réservation par formulaire et plan de salle (incluse). Dans « Voir », vous pouvez l&apos;essayer gratuitement.
        </p>
      )}

      {!team && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {AI_PLANS.map((p) => {
            const mine = offer?.plan === p.id;
            return (
              <button key={p.id} type="button" disabled={mine}
                onClick={() => setAsked(p.id)}
                className={`rounded-xl border p-3 text-left transition ${mine ? "border-clic bg-clic/10" : asked === p.id ? "border-ink/60" : "border-line hover:border-ink/40"}`}>
                <span className="block text-sm font-medium">{p.name}{mine ? " ✓" : ""}</span>
                <span className="mt-1 block font-display text-2xl font-semibold tracking-tight">{p.price}<span className="text-xs font-normal text-muted"> /mois</span></span>
                <span className="mt-1 block text-[11px] text-muted">{p.quota.toLocaleString("fr-FR")} conversations par mois</span>
              </button>
            );
          })}
        </div>
      )}
      {asked && (
        <p className="mt-3 rounded-lg bg-clic/10 px-3 py-2 text-xs leading-relaxed">
          Le paiement en ligne de l&apos;option arrive très bientôt. En attendant, écrivez-nous et nous l&apos;activons pour vous.
        </p>
      )}
      {offer && !offer.ready && (
        <p className="mt-2 text-xs text-muted">Option en cours d&apos;installation.</p>
      )}
    </div>
  );
}
