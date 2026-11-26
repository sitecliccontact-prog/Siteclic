import { AI_PLANS, HOSTING, OFFERS } from "@/lib/pricing";

/** Les deux offres + l'hébergement. Utilisé sur l'accueil et la page des tarifs. */
export function PriceCards({ compact }: { compact?: boolean }) {
  return (
    <div>
      <div className={`grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
        {OFFERS.map((o) => (
          <div key={o.id}
            className={`rounded-[2rem] border p-7 sm:p-8 ${o.highlight
              ? "border-clic/60 bg-card shadow-[0_40px_80px_-40px_rgba(255,91,31,.45)]"
              : "border-line bg-card"}`}>
            {o.highlight && (
              <span className="mb-4 inline-block rounded-full bg-clic px-3 py-1 text-xs font-medium text-white">Le plus avantageux</span>
            )}
            <p className="font-medium">{o.name}</p>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-6xl font-semibold tracking-tight">{o.price}</span>
              <span className="text-muted">{o.unit}</span>
            </p>
            {o.note && <p className="mt-1 text-sm font-medium text-clic">{o.note}</p>}
            <ul className="mt-6 space-y-3">
              {o.features.map((f) => (
                <li key={f} className="flex gap-3 text-[15px]">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-clic/15 text-[11px] text-clic">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-[2rem] border border-line bg-card/60 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="font-medium">Hébergement</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">Pour garder votre site en ligne, rapide et sécurisé. Sans engagement.</p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="flex items-baseline gap-2 sm:justify-end">
            <span className="font-display text-3xl font-semibold tracking-tight">{HOSTING.year}</span>
            <span className="text-muted">/ an</span>
          </p>
          <p className="text-sm text-muted">soit {HOSTING.yearMonthly}/mois · ou {HOSTING.month} au mois</p>
        </div>
      </div>

      <div className="mt-4 rounded-[2rem] border border-line bg-card/60 p-7 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[.2em] text-clic">En option</p>
        <p className="mt-2 font-medium">Assistant IA de réservation</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Vos clients réservent en parlant à un assistant qui connaît votre carte, vos horaires et vos tables, de jour comme de nuit.
          Sans l&apos;option, la réservation par formulaire et plan de salle reste incluse.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {AI_PLANS.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line bg-card p-5">
              <p className="font-medium">{p.name}</p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-muted">/ mois</span>
              </p>
              <p className="mt-1 text-sm text-muted">{p.quota.toLocaleString("fr-FR")} conversations par mois · {p.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Limite atteinte ? Le formulaire de réservation prend le relais automatiquement, sans frais en plus.</p>
      </div>
    </div>
  );
}
