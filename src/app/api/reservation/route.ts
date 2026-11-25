import { NextResponse } from "next/server";
import { z } from "zod";
import { bookTable } from "@/lib/site/booking";
import { createClient } from "@/lib/supabase/server";

/* Demande de réservation envoyée depuis le site public d'un commerçant. */

const Body = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^[0-2]\d:[0-5]\d$/),
  people: z.coerce.number().int().min(1).max(30),
  message: z.string().trim().max(500).default(""),
  table: z.string().trim().max(20).default(""),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez votre nom, votre téléphone, la date et l'heure." }, { status: 400 });
  const b = parsed.data;
  const supabase = await createClient();
  const { error } = await bookTable(supabase, b);
  if (!error) return NextResponse.json({ ok: true });
  const msg = error.message ?? "";
  if (msg.includes("table_prise")) return NextResponse.json({ error: "Cette table vient d'être réservée à cette heure-là. Choisissez-en une autre." }, { status: 409 });
  if (msg.includes("reservation_trop")) return NextResponse.json({ error: "Beaucoup de demandes aujourd'hui : merci d'appeler directement." }, { status: 429 });
  if (msg.includes("reservation_invalide")) return NextResponse.json({ error: "Vérifiez la date (aujourd'hui ou plus tard), l'heure et votre téléphone." }, { status: 400 });
  console.error("Réservation impossible", error);
  return NextResponse.json({ error: "La réservation en ligne n'est pas disponible pour le moment. Merci d'appeler directement." }, { status: 503 });
}
