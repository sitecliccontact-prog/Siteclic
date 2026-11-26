import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Statistiques simples des 30 derniers jours : visites, réservations, commandes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [visits, resas, orders] = await Promise.all([
    supabase.from("site_visits").select("day, visits").eq("site_id", id).gte("day", since).order("day"),
    supabase.from("reservations").select("id", { count: "exact", head: true }).eq("site_id", id).gte("created_at", since),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("site_id", id).gte("created_at", since),
  ]);
  // Fichier SQL 13 pas encore exécuté : on le signale gentiment.
  if (visits.error) return NextResponse.json({ ready: false });
  const byDay = new Map((visits.data ?? []).map((v) => [v.day as string, v.visits as number]));
  const days = Array.from({ length: 30 }, (_, k) => {
    const d = new Date(Date.now() - (29 - k) * 86400000).toISOString().slice(0, 10);
    return { day: d, visits: byDay.get(d) ?? 0 };
  });
  return NextResponse.json({ ready: true, days, reservations: resas.count ?? 0, orders: orders.error ? 0 : orders.count ?? 0 });
}
