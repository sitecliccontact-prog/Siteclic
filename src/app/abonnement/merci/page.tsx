import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { safeReturn } from "@/lib/billing/stripe";

export const metadata: Metadata = { title: "Merci · SiteClic", robots: { index: false } };

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const retour = safeReturn((await searchParams).retour);
  return (
    <main className="grain min-h-dvh px-5 py-6">
      <header className="mx-auto max-w-5xl"><Logo /></header>
      <section className="rise mx-auto mt-20 max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Bienvenue</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Merci, c&apos;est parti.</h1>
        <p className="mt-4 text-muted">Votre paiement est validé. Vous pouvez mettre votre site en ligne et le modifier quand vous voulez.</p>
        <Link href={retour} className="mt-8 inline-block rounded-full bg-clic px-8 py-4 font-semibold text-white">Continuer</Link>
        <p className="mt-6 text-xs text-muted">Votre reçu vous est envoyé par e-mail.</p>
      </section>
    </main>
  );
}
