import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Carte de fidélité : tampons gardés par SiteClic, ajoutés avec le code du jour que le commerçant montre en caisse. */

const Slug = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Card = z.string().uuid();

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slug = Slug.safeParse(q.get("slug"));
  const card = Card.safeParse(q.get("card"));
  if (!slug.success || !card.success) return NextResponse.json({ stamps: 0 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loyalty_count", { p_slug: slug.data, p_card: card.data });
  return NextResponse.json({ stamps: typeof data === "number" ? data : 0, ready: !error }, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({ slug: Slug, card: Card, code: z.string().regex(/^\d{4}$/), redeem: z.boolean().default(false) });
const ERRORS: Record<number, string> = {
  [-1]: "Ce code n'est pas le bon. Demandez le code du jour en caisse.",
  [-2]: "Trop d'essais aujourd'hui. Réessayez demain.",
  [-3]: "Vous avez déjà eu votre tampon aujourd'hui. À demain !",
  [-4]: "Il manque encore des tampons pour la récompense.",
};

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Entrez le code à 4 chiffres donné en caisse." }, { status: 400 });
  const b = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loyalty_use", { p_slug: b.slug, p_card: b.card, p_code: b.code, p_redeem: b.redeem });
  if (error || typeof data !== "number") {
    console.error("Fidélité", error);
    return NextResponse.json({ error: "La carte de fidélité n'est pas disponible pour le moment." }, { status: 503 });
  }
  if (data < 0) return NextResponse.json({ error: ERRORS[data] ?? "Impossible pour le moment." }, { status: 400 });
  return NextResponse.json({ stamps: data });
}
