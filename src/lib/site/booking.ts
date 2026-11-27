import "server-only";
import { after } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import { notifyOwner, whenLabel } from "@/lib/push";

type Supa = Awaited<ReturnType<typeof createClient>>;
export type BookingInput = { slug: string; name: string; phone: string; day: string; time: string; people: number; message: string; table?: string };

/** Enregistre une réservation (avec la table choisie). Si le texte SQL 09 n'est pas encore passé, utilise l'ancienne fonction. */
export async function bookTable(supabase: Supa, b: BookingInput) {
  const base = { p_slug: b.slug, p_name: b.name, p_phone: b.phone, p_day: b.day, p_time: b.time, p_people: b.people, p_message: b.message };
  const res = await supabase.rpc("book_table", { ...base, p_table: b.table ?? "" });
  const out = res.error && (res.error.code === "PGRST202" || res.error.code === "42883") ? await supabase.rpc("request_reservation", base) : res;
  if (!out.error) {
    after(() => notifyOwner(b.slug, {
      title: "Nouvelle réservation",
      body: `${b.name}, ${b.people} pers., ${whenLabel(b.day, b.time)}${b.table ? ` · table ${b.table}` : ""}`,
      url: "/tableau-de-bord/reservations", tag: "reservation",
    }));
  }
  return out;
}
