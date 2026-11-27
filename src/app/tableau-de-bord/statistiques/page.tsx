import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getAppSettings } from "@/lib/app-settings";
import { billingEnabled, stripe } from "@/lib/billing/stripe";
import { isTeam } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";
import { OwnerSettings } from "./OwnerSettings";
import { DomainsAdmin, type DomainRow } from "./DomainsAdmin";

export const metadata: Metadata = { title: "Mes statistiques · SiteClic" };
export const dynamic = "force-dynamic";

type Stats = {
  users: number; confirmed: number; signups: { day: string; n: number }[]; free_users: number;
  sites: number; online: number; sites_30: number; ai: { kind: string; free: boolean; n: number }[];
  free_today_cents: number; free_30_cents: number; abuse: { reason: string; n: number }[]; reservations: number;
};

/* Coût IA estimé par utilisation (voir mémo coûts) : création/import ≈ 25 c, modification ≈ 5 c. */
const COST: Record<string, number> = { creation: 25, import: 25, modification: 5 };
const REASONS: Record<string, string> = {
  confirmer: "e-mail pas confirmé", essai_ferme: "essai fermé", deja_utilise: "même e-mail (alias)", appareil: "même téléphone",
  internet: "même connexion Internet", budget: "budget du jour atteint",
};
const euros = (c: number) => `${(c / 100).toLocaleString("fr-FR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;

/** Paiements des 30 derniers jours chez Stripe (ventes SiteClic + commissions 2 % des restaurants). */
async function money() {
  if (!billingEnabled()) return null;
  try {
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    const [charges, fees, subs] = await Promise.all([
      stripe().charges.list({ created: { gte: since }, limit: 100 }),
      stripe().applicationFees.list({ created: { gte: since }, limit: 100 }),
      stripe().subscriptions.list({ status: "active", limit: 100 }),
    ]);
    const sales = charges.data.filter((c) => c.paid && !c.refunded).reduce((s, c) => s + c.amount - c.amount_refunded, 0);
    const commissions = fees.data.reduce((s, f) => s + f.amount - f.amount_refunded, 0);
    return { sales, commissions, payers: new Set(charges.data.filter((c) => c.paid).map((c) => c.customer)).size, subs: subs.data.length };
  } catch (err) {
    console.error("Statistiques Stripe", err);
    return null;
  }
}

export default async function OwnerStatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  if (!isTeam(user)) notFound();

  const [{ data, error }, settings, cash, domains] = await Promise.all([supabase.rpc("owner_stats"), getAppSettings(), money(), supabase.rpc("domain_list")]);
  const s = data as Stats | null;

  const days = Array.from({ length: 30 }, (_, k) => new Date(Date.now() - (29 - k) * 86400000).toISOString().slice(0, 10));
  const byDay = new Map((s?.signups ?? []).map((x) => [x.day, x.n]));
  const max = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0));
  const ai = (free: boolean) => (s?.ai ?? []).filter((a) => a.free === free);
  const aiCost = (free: boolean) => ai(free).reduce((t, a) => t + a.n * (COST[a.kind] ?? 0), 0);
  const aiCount = (free: boolean, kinds: string[]) => ai(free).filter((a) => kinds.includes(a.kind)).reduce((t, a) => t + a.n, 0);
  const blocked = (s?.abuse ?? []).reduce((t, a) => t + a.n, 0);

  return (
    <main className="min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <Link href="/tableau-de-bord" className="text-sm text-muted hover:text-ink">← Mes sites</Link>
      </header>
      <section className="rise mx-auto mt-10 max-w-3xl space-y-8 pb-20">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Propriétaire</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Mes statistiques</h1>
          <p className="mt-3 text-muted">Tout SiteClic sur les 30 derniers jours. Visible seulement par toi. Tes propres comptes ne sont pas comptés dans les inscrits.</p>
        </div>
        {(error || !s) && (
          <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Ajoute le texte SQL n°14 dans Supabase pour voir les statistiques (code BDD-{error?.code ?? "?"}).
          </p>
        )}
        {s && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile n={String(s.users)} label="inscrits" sub={`${s.confirmed} e-mails confirmés`} />
              <Tile n={String(s.free_users)} label="essais gratuits" sub="personnes différentes" />
              <Tile n={String(s.sites)} label="sites créés" sub={`${s.online} en ligne`} />
              <Tile n={String(blocked)} label="abus bloqués" sub="30 jours" hot={blocked > 0} />
            </div>

            <Box title="Inscriptions par jour">
              <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Inscriptions des 30 derniers jours">
                {days.map((d) => {
                  const n = byDay.get(d) ?? 0;
                  return <div key={d} title={`${d.slice(8)}/${d.slice(5, 7)} : ${n}`} className="flex-1 rounded-t-sm bg-clic" style={{ height: `${Math.max(3, (n / max) * 100)}%`, opacity: n ? 1 : 0.2 }} />;
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted"><span>il y a 30 jours</span><span>aujourd&apos;hui</span></div>
            </Box>

            <Box title="Coût de l'IA (estimation)">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-cream p-3">
                  <p className="text-xs text-muted">Comptes gratuits</p>
                  <p className="mt-1 text-2xl font-semibold">{euros(aiCost(true))}</p>
                  <p className="mt-1 text-xs text-muted">{aiCount(true, ["creation", "import"])} sites · {aiCount(true, ["modification"])} modifs</p>
                  <p className="mt-1 text-xs text-muted">Aujourd&apos;hui : {euros(s.free_today_cents)} / {euros(settings.free_budget_cents)}</p>
                </div>
                <div className="rounded-xl bg-cream p-3">
                  <p className="text-xs text-muted">Comptes payants</p>
                  <p className="mt-1 text-2xl font-semibold">{euros(aiCost(false))}</p>
                  <p className="mt-1 text-xs text-muted">{aiCount(false, ["creation", "import"])} sites · {aiCount(false, ["modification"])} modifs</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted">Le vrai montant est sur console.anthropic.com (Usage). Ici : ≈ 25 c par site, ≈ 5 c par modification.</p>
            </Box>

            <Box title="Argent gagné (30 jours)">
              {cash ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Tile n={euros(cash.sales)} label="ventes" />
                  <Tile n={euros(cash.commissions)} label="commissions 2 %" />
                  <Tile n={String(cash.payers + cash.subs)} label="clients payants" />
                </div>
              ) : <p className="text-sm text-muted">Le paiement Stripe n&apos;est pas encore activé : les revenus s&apos;afficheront ici automatiquement.</p>}
            </Box>

            <Box title="Abus bloqués (30 jours)">
              {s.abuse.length ? (
                <ul className="space-y-1 text-sm">
                  {s.abuse.map((a) => <li key={a.reason} className="flex justify-between"><span>{REASONS[a.reason] ?? a.reason}</span><span className="font-semibold">{a.n}</span></li>)}
                </ul>
              ) : <p className="text-sm text-muted">Aucun pour l&apos;instant 👍</p>}
            </Box>

            <p className="text-sm text-muted">{s.reservations} réservations reçues par les restaurants ce mois-ci · {s.sites_30} sites créés ce mois-ci.</p>
          </>
        )}
        <DomainsAdmin initial={(domains.data ?? []) as DomainRow[]} />
        <OwnerSettings initial={settings} />
      </section>
    </main>
  );
}

function Tile({ n, label, sub, hot }: { n: string; label: string; sub?: string; hot?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${hot ? "border-clic/50 bg-clic/10" : "border-line bg-card"}`}>
      <p className={`font-display text-2xl font-semibold sm:text-3xl ${hot ? "text-clic" : ""}`}>{n}</p>
      <p className="text-xs text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted/70">{sub}</p>}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="mb-3 font-medium">{title}</p>
      {children}
    </div>
  );
}
