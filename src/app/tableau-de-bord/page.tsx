import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export const metadata: Metadata = { title: "Mes sites · SiteClic" };

type SiteRow = { id: string; name: string; trade: string | null; status: string; created_at: string };

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const shopName = (user.user_metadata?.shop_name as string) || "";

  const { data } = await supabase
    .from("sites")
    .select("id, name, trade, status, created_at")
    .order("created_at", { ascending: false });
  const sites = (data ?? []) as SiteRow[];

  return (
    <main className="min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        <SignOutButton />
      </header>

      <section className="rise mx-auto mt-12 max-w-5xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Mes sites</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Bonjour{shopName ? `, ${shopName}` : ""} 👋
        </h1>
        <p className="mt-3 max-w-xl text-muted">Que voulez-vous faire aujourd&apos;hui ?</p>

        {sites.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-medium text-muted">Vos sites</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {sites.map((s) => (
                <li key={s.id}>
                  <Link href={`/tableau-de-bord/sites/${s.id}`}
                    className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-card p-6 transition hover:border-ink/30">
                    <div>
                      <p className="font-display text-xl font-semibold">{s.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {s.trade ? `${s.trade} · ` : ""}
                        {s.status === "en_ligne" ? "En ligne" : "Aperçu"}
                      </p>
                    </div>
                    <span className="text-clic">Modifier →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <ActionCard
            href="/tableau-de-bord/creer"
            title={sites.length ? "Créer un autre site" : "Créer mon site"}
            text="Répondez à quelques questions, l'IA crée un site élégant pour votre commerce."
            primary
          />
          <ActionCard
            href="/tableau-de-bord/importer"
            title="Importer mon site actuel"
            text="Collez l'adresse de votre site, l'IA en fait une version plus belle et plus moderne."
          />
        </div>

        <p className="mt-10 text-sm text-muted">
          <Link href="/" className="underline underline-offset-4">Retour à l&apos;accueil</Link>
        </p>
      </section>
    </main>
  );
}

function ActionCard({ title, text, badge, primary, href }: { title: string; text: string; badge?: string; primary?: boolean; href?: string }) {
  const body = (
    <div className={`relative h-full rounded-3xl border p-7 transition ${primary ? "border-ink bg-ink text-cream" : "border-line bg-card"} ${href ? "hover:-translate-y-0.5" : ""}`}>
      {badge && (
        <span className={`mb-5 inline-block rounded-full px-3 py-1 text-xs font-medium ${primary ? "bg-cream/10 text-cream" : "bg-sand text-muted"}`}>
          {badge}
        </span>
      )}
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className={`mt-2 text-[15px] leading-relaxed ${primary ? "text-cream/70" : "text-muted"}`}>{text}</p>
      {href && <p className="mt-5 font-medium text-clic">Commencer →</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
