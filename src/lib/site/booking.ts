import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;
export type BookingInput = { slug: string; name: string; phone: string; day: string; time: string; people: number; message: string; table?: string };

/** Enregistre une réservation (avec la table choisie). Si le texte SQL 09 n'est pas encore passé, utilise l'ancienne fonction. */
export async function bookTable(supabase: Supa, b: BookingInput) {
  const base = { p_slug: b.slug, p_name: b.name, p_phone: b.phone, p_day: b.day, p_time: b.time, p_people: b.people, p_message: b.message };
  const res = await supabase.rpc("book_table", { ...base, p_table: b.table ?? "" });
  if (res.error && (res.error.code === "PGRST202" || res.error.code === "42883")) {
    return supabase.rpc("request_reservation", base);
  }
  return res;
}
