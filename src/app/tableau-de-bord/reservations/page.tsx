import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { Board, type Resa } from "./Board";

export const metadata: Metadata = { title: "Réservations · SiteClic" };
export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [{ data: sites }, { data, error }] = await Promise.all([
    supabase.from("sites").select("id, name"),
    supabase.from("reservations").select("*").gte("day", since).order("day").order("time").limit(300),
  ]);
  const names = Object.fromEntries((sites ?? []).map((s) => [s.id, s.name as string]));
  const list: Resa[] = (data ?? []).map((r) => ({ ...r, status: r.status ?? "nouvelle", site: names[r.site_id] ?? "" }));

  return (
    <main className="min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <Link href="/tableau-de-bord" className="text-sm text-muted hover:text-ink">← Mes sites</Link>
      </header>
      <section className="rise mx-auto mt-10 max-w-3xl pb-20">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Tableau</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Réservations</h1>
        <p className="mt-3 text-muted">Les demandes de vos clients, depuis votre site ou votre assistant IA. Confirmez, puis prévenez le client par SMS en un geste.</p>
        {error && (
          <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Le tableau n&apos;est pas encore activé (code BDD-{error.code}).
          </p>
        )}
        <Board initial={list} multiSite={(sites ?? []).length > 1} />
      </section>
    </main>
  );
}
