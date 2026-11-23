import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { creationBlocked } from "@/lib/site/limits";
import { createClient } from "@/lib/supabase/server";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "Créer mon site · SiteClic" };

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const shopName = (user.user_metadata?.shop_name as string) || "";
  const blocked = await creationBlocked(supabase, user);

  return (
    <main className="grain min-h-dvh px-5 py-6">
      <header className="mx-auto max-w-5xl"><Logo /></header>
      <section className="mt-12 pb-16">
        {blocked ? (
          <div className="rise mx-auto max-w-md rounded-3xl border border-line bg-card p-7">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Créer un site</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Vos sites gratuits sont créés.</h1>
            <p className="mt-3 leading-relaxed text-muted">{blocked.message}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {blocked.subscribe && (
                <Link href="/abonnement?retour=/tableau-de-bord/creer" className="rounded-full bg-clic px-5 py-3 font-medium text-white">Voir l&apos;abonnement</Link>
              )}
              <Link href="/tableau-de-bord" className="rounded-full border border-line px-5 py-3 font-medium">Mes sites</Link>
            </div>
          </div>
        ) : (
          <Wizard defaultName={shopName} />
        )}
      </section>
    </main>
  );
}
