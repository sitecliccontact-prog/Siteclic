import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LEGAL } from "@/lib/legal";

/** Mise en page commune des pages légales (mentions, confidentialité, conditions de vente). */
export function LegalPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <Link href="/" className="text-sm text-muted hover:text-ink">← Accueil</Link>
      </header>
      <article className="rise mx-auto mt-12 max-w-3xl pb-20">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Dernière mise à jour : {LEGAL.updated}</p>
        <div className="legal mt-10 space-y-8 text-[15px] leading-relaxed text-ink/85">{children}</div>
        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm text-muted">
          <Link href="/mentions-legales" className="hover:text-ink">Mentions légales</Link>
          <Link href="/confidentialite" className="hover:text-ink">Confidentialité</Link>
          <Link href="/cgv" className="hover:text-ink">Conditions de vente</Link>
          <a href={`mailto:${LEGAL.email}`} className="hover:text-ink">{LEGAL.email}</a>
        </nav>
      </article>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted [&_strong]:font-medium [&_strong]:text-ink">{children}</div>
    </section>
  );
}
