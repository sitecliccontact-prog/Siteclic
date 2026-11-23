import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ManageButton, SubscribeButton } from "@/components/BillingButtons";
import { Logo } from "@/components/Logo";
import { billingEnabled, getSubscription, safeReturn } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Abonnement · SiteClic", robots: { index: false } };

const INCLUDED = [
  ["Votre site en ligne", "Une adresse à partager à vos clients, sur Google, Instagram ou WhatsApp."],
  ["Modifications par l'IA", "Écrivez « on ferme à 19h le samedi », votre site est à jour."],
  ["Import de votre site actuel", "Collez son adresse, l'IA en fait une version plus belle."],
  ["Hébergement inclus", "Rapide, sécurisé, préparé pour Google. Rien à installer."],
];

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
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Abonnement</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {sub?.active ? "Vous êtes abonné." : "Votre site, en ligne. Toujours à jour."}
        </h1>

        {sub?.active ? (
          <div className="mt-8 rounded-3xl border border-line bg-card p-7">
            <p className="flex items-center gap-2 font-medium"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Abonnement actif</p>
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
            <p className="mt-4 text-muted">L&apos;aperçu est gratuit. Pour mettre votre site en ligne et le faire vivre, passez à l&apos;abonnement.</p>
            <div className="mt-8 rounded-3xl border border-line bg-card p-7">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-6xl font-extrabold tracking-tight">29 €</span>
                <span className="text-muted">/ mois</span>
              </p>
              <p className="mt-1 text-sm text-muted">Sans engagement. Résiliable en un clic.</p>
              <ul className="mt-7 space-y-5">
                {INCLUDED.map(([t, d]) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-clic" />
                    <span>
                      <span className="block font-medium">{t}</span>
                      <span className="block text-sm leading-relaxed text-muted">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {enabled ? (
                  <SubscribeButton retour={retour} />
                ) : (
                  <p className="rounded-2xl bg-sand px-4 py-3 text-center text-sm text-muted">Le paiement ouvre très bientôt. En attendant, tout est inclus.</p>
                )}
              </div>
              <p className="mt-4 text-center text-xs text-muted">Paiement sécurisé par Stripe. Carte bancaire, Apple Pay, Google Pay.</p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
