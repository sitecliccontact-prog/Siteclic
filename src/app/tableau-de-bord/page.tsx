import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export const metadata: Metadata = { title: "Mes sites · SiteClic" };

export default async function Dashboard() {
  let shopName = "";
  if (supabaseReady) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/connexion");
    shopName = (user.user_metadata?.shop_name as string) || "";
  }

  return (
    <main className="min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        {supabaseReady && <SignOutButton />}
      </header>

      <section className="mx-auto mt-12 max-w-5xl rise">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Mes sites</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Bonjour{shopName ? `, ${shopName}` : ""} 👋
        </h1>
        <p className="mt-3 max-w-xl text-muted">Que voulez-vous faire aujourd&apos;hui ?</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <ActionCard
            title="Créer mon site"
            text="Répondez à quelques questions, l'IA crée un site élégant pour votre commerce."
            badge="Bientôt"
            primary
          />
          <ActionCard
            title="Importer mon site actuel"
            text="Collez l'adresse de votre site, l'IA en fait une version plus belle et plus moderne."
            badge="Bientôt"
          />
        </div>

        <p className="mt-10 text-sm text-muted">
          <Link href="/" className="underline underline-offset-4">Retour à l&apos;accueil</Link>
        </p>
      </section>
    </main>
  );
}

function ActionCard({ title, text, badge, primary }: { title: string; text: string; badge: string; primary?: boolean }) {
  return (
    <div className={`relative rounded-3xl border p-7 ${primary ? "border-ink bg-ink text-cream" : "border-line bg-card"}`}>
      <span className={`mb-5 inline-block rounded-full px-3 py-1 text-xs font-medium ${primary ? "bg-cream/10 text-cream" : "bg-sand text-muted"}`}>
        {badge}
      </span>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className={`mt-2 text-[15px] leading-relaxed ${primary ? "text-cream/70" : "text-muted"}`}>{text}</p>
    </div>
  );
}
