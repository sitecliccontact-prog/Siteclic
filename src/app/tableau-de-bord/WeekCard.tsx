/* Rapport de la semaine (carte du tableau de bord). */

type Week = { visits: number; reservations: number; rdv: number; orders: number; sales: number; subscribers: number };
export type WeekRow = { id: string; name: string; now: Week; before: Week };

/** Rapport de la semaine : les 7 derniers jours, comparés aux 7 jours d'avant (aussi envoyé le lundi matin en notification). */
export function WeekCard({ week }: { week: WeekRow[] }) {
  const sum = (k: keyof Week, w: "now" | "before") => week.reduce((n, r) => n + (Number(r[w][k]) || 0), 0);
  const tiles: { label: string; k: (keyof Week)[]; euro?: boolean }[] = [
    { label: "Visites", k: ["visits"] },
    { label: "Réservations", k: ["reservations", "rdv"] },
    { label: "Commandes", k: ["orders"] },
    { label: "Ventes", k: ["sales"], euro: true },
  ];
  return (
    <div id="semaine" className="mt-10 rounded-3xl border border-line bg-card/80 p-5 backdrop-blur">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-clic" /> Votre semaine</h2>
        <span className="text-right text-xs text-muted">7 derniers jours{week.length > 1 ? ` · ${week.length} sites` : ""}<br />vs semaine d&apos;avant</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => {
          const now = t.k.reduce((n, k) => n + sum(k, "now"), 0);
          const before = t.k.reduce((n, k) => n + sum(k, "before"), 0);
          const diff = before ? Math.round(((now - before) / before) * 100) : null;
          return (
            <div key={t.label} className="rounded-2xl bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted">{t.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold">{t.euro ? `${Math.round(now / 100)} €` : now}</p>
              <p className={`text-xs ${diff === null ? "text-muted" : diff >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {diff === null ? (now ? "nouveau" : "—") : `${diff >= 0 ? "▲ +" : "▼ "}${diff} %`}
              </p>
            </div>
          );
        })}
      </div>
      {sum("subscribers", "now") > 0 && <p className="mt-3 text-sm text-ink/80">+{sum("subscribers", "now")} inscrit(s) à votre newsletter cette semaine.</p>}
    </div>
  );
}

