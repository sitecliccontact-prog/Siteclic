import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Newsletter / SMS : le client laisse son e-mail ou son téléphone (avec son accord). */

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  contact: z.string().trim().min(6).max(120),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indiquez un e-mail ou un téléphone, et cochez la case." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subscribe", { p_slug: parsed.data.slug, p_contact: parsed.data.contact });
  if (!error) return NextResponse.json({ ok: true, kind: data });
  if (error.message?.includes("contact_invalide")) return NextResponse.json({ error: "Cet e-mail ou ce numéro ne semble pas valide." }, { status: 400 });
  if (error.message?.includes("newsletter_trop")) return NextResponse.json({ error: "Réessayez un peu plus tard." }, { status: 429 });
  console.error("Newsletter", error);
  return NextResponse.json({ error: "Inscription indisponible pour le moment." }, { status: 503 });
}
