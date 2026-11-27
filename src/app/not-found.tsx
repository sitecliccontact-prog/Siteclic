import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="grain flex min-h-dvh flex-col px-5 py-6">
      <Logo />
      <div className="rise mx-auto flex max-w-md flex-1 flex-col justify-center py-16 text-center">
        <p className="font-display text-8xl font-semibold tracking-tight text-clic">404</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Cette page n&apos;existe pas.</h1>
        <p className="mt-3 text-muted">Le lien est peut-être incomplet, ou la page a été déplacée.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/tableau-de-bord" className="rounded-full bg-clic px-6 py-3.5 font-medium text-white">Mes sites</Link>
          <Link href="/" className="rounded-full border border-line px-6 py-3.5 font-medium hover:border-ink/40">Accueil</Link>
        </div>
      </div>
    </main>
  );
}
