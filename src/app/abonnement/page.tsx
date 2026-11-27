import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ManageButton, PlanPicker } from "@/components/BillingButtons";
import { Logo } from "@/components/Logo";
import { PriceCards } from "@/components/PriceCards";
import { billingEnabled, getSubscription, safeReturn } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { OPTIONS } from "@/lib/pricing";

export const metadata: Metadata = { title: "Tarifs · SiteClic", robots: { index: false } };


export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const retour = safeReturn((await searchParams).retour);
  const enabled = billingEnabled();
  const sub = enabled ? await getSubscription(user).catch(() => null) : null;

  return (
    <main className="grain min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        <Link href={retour} className="text-sm text-muted hover:text-ink">← Retour</Link>
      </header>

      <section className="rise mx-auto mt-12 max-w-md pb-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Tarifs</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {sub?.active ? "Votre site est actif." : "Votre site, en ligne. Toujours à jour."}
        </h1>

        {sub?.active ? (
          <div className="mt-8 rounded-3xl border border-line bg-card p-7">
            <p className="flex items-center gap-2 font-medium"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Hébergement actif</p>
            {sub.periodEnd && (
              <p className="mt-2 text-sm text-muted">
                {sub.cancelAtPeriodEnd ? "Se termine le " : "Prochain paiement le "}
                {new Date(sub.periodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            {sub.status === "past_due" && (
              <p className="mt-3 text-sm text-amber-300">Le dernier paiement n&apos;est pas passé. Mettez à jour votre carte pour garder votre site en ligne.</p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={retour} className="rounded-full bg-clic px-5 py-3 font-medium text-white">Continuer</Link>
              <ManageButton className="rounded-full border border-line px-5 py-3 font-medium hover:border-ink/40" />
            </div>
          </div>
        ) : (
          <>
            <p className="mt-4 text-muted">L&apos;aperçu est gratuit. Vous payez votre site une seule fois, puis un petit hébergement pour le garder en ligne.</p>
            <div className="mt-8">
              <PriceCards compact />
            </div>
            <div className="mt-6">
              {enabled ? (
                <PlanPicker retour={retour} />
              ) : (
                <p className="rounded-2xl bg-sand px-4 py-3 text-center text-sm text-muted">Le paiement ouvre très bientôt. En attendant, tout est inclus.</p>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-muted">Paiement sécurisé par Stripe. Carte bancaire, Apple Pay, Google Pay.</p>
          </>
        )}
        <div className="mt-10 rounded-3xl border border-line bg-card p-6">
          <p className="font-display text-xl font-semibold">Options en plus</p>
          <p className="mt-1 text-sm text-muted">À activer seulement si vous en avez besoin, dans « Modifier moi-même ».</p>
          <ul className="mt-4 divide-y divide-line text-sm">
            {Object.values(OPTIONS).map((o) => (
              <li key={o.name} className="flex justify-between gap-3 py-2.5"><span>{o.name}</span><span className={o.price === "Inclus" ? "text-emerald-300" : "font-semibold"}>{o.price}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
