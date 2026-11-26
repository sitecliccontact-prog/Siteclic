import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Liste d'attente : le restaurant est complet, le client laisse son numéro (prévenu par SMS si une table se libère). */

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^[0-2]\d:[0-5]\d$/),
  people: z.coerce.number().int().min(1).max(30),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez votre nom et votre téléphone." }, { status: 400 });
  const b = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_waitlist", { p_slug: b.slug, p_name: b.name, p_phone: b.phone, p_day: b.day, p_time: b.time, p_people: b.people });
  if (!error) return NextResponse.json({ ok: true });
  if (error.message?.includes("reservation_trop")) return NextResponse.json({ error: "Beaucoup de demandes aujourd'hui : merci d'appeler directement." }, { status: 429 });
  if (error.message?.includes("reservation_invalide")) return NextResponse.json({ error: "Vérifiez la date et votre téléphone." }, { status: 400 });
  console.error("Liste d'attente", error);
  return NextResponse.json({ error: "La liste d'attente n'est pas disponible pour le moment. Merci d'appeler." }, { status: 503 });
}
