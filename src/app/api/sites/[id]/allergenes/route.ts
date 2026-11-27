import { NextResponse } from "next/server";
import { z } from "zod";
import { ask, explainError } from "@/lib/site/generate";
import { consumeAi } from "@/lib/site/limits";
import { ALLERGENS, parseStoredContent } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/* Allergènes : l'IA lit chaque plat de la carte et propose ses allergènes (14 allergènes officiels).
   Le commerçant vérifie et corrige avant d'enregistrer. Compte comme 1 modification IA (≈ 1 à 3 centimes). */

const Out = z.object({
  dishes: z.array(z.object({
    name: z.string().describe("Nom du plat, recopié exactement"),
    allergens: z.array(z.enum(ALLERGENS)).describe("Allergènes très probables d'après le nom et la description ; liste vide si aucun"),
  })),
});

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const { data: row } = await supabase.from("sites").select("content").eq("id", id).maybeSingle();
  const c = parseStoredContent(row?.content);
  if (!c) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });
  const dishes = c.offer.categories.flatMap((k) => k.items.map((i) => ({ categorie: k.name, nom: i.name, description: i.description })));
  if (!dishes.length) return NextResponse.json({ error: "Votre carte est vide : ajoutez d'abord vos plats." }, { status: 400 });

  const limit = await consumeAi(supabase, user, "modification");
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: 429 });
  try {
    const out = await ask(
      Out,
      `Tu es un chef de cuisine français qui connaît le règlement européen INCO. Pour chaque plat, indique les allergènes parmi ces 14 : ${ALLERGENS.join(", ")}. Base-toi sur la recette classique du plat et sur sa description. Pas d'allergène inventé : seulement ceux qui sont très probables (ex. pâte = Gluten et Œufs, fromage = Lait, vin dans la sauce = Sulfites). Une boisson simple n'en a souvent aucun.`,
      `<carte>${JSON.stringify(dishes.slice(0, 120))}</carte>`,
      "low",
      "eco",
    );
    const names = new Set(dishes.map((d) => d.nom));
    const map: Record<string, string[]> = {};
    for (const d of out.dishes) if (names.has(d.name) && d.allergens.length) map[d.name] = [...new Set(d.allergens)];
    return NextResponse.json({ allergens: map });
  } catch (err) {
    console.error("Allergènes", err);
    return NextResponse.json({ error: explainError(err, "L'IA n'a pas pu lire la carte. Réessayez.") }, { status: 500 });
  }
}
