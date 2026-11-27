import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { ClientsBoard, type Application, type Subscriber } from "./ClientsBoard";

export const metadata: Metadata = { title: "Inscrits et candidatures · SiteClic" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const [{ data: sites }, apps, subs] = await Promise.all([
    supabase.from("sites").select("id, name"),
    supabase.from("job_applications").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("subscribers").select("id, site_id, contact, kind, created_at").order("created_at", { ascending: false }).limit(2000),
  ]);
  const names = Object.fromEntries((sites ?? []).map((s) => [s.id, s.name as string]));
  const applications: Application[] = (apps.data ?? []).map((a) => ({ id: a.id, site: names[a.site_id] ?? "", job: a.job, name: a.name, phone: a.phone, email: a.email, message: a.message, cv: a.cv, seen: a.seen, created_at: a.created_at }));
  const subscribers: Subscriber[] = (subs.data ?? []).map((s) => ({ id: s.id, site: names[s.site_id] ?? "", contact: s.contact, kind: s.kind, created_at: s.created_at }));

  return (
    <main className="min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <Link href="/tableau-de-bord" className="text-sm text-muted hover:text-ink">← Mes sites</Link>
      </header>
      <section className="rise mx-auto mt-10 max-w-3xl pb-20">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Tableau</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Inscrits et candidatures</h1>
        <p className="mt-3 text-muted">Les candidatures reçues sur vos annonces, et les clients inscrits à vos nouvelles (e-mail ou SMS).</p>
        {(apps.error || subs.error) && (
          <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Pas encore activé : ajoutez le code Supabase n°4 (16-options) dans Supabase.
          </p>
        )}
        <ClientsBoard applications={applications} subscribers={subscribers} multiSite={(sites ?? []).length > 1} />
      </section>
    </main>
  );
}
