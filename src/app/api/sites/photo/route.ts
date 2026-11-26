import { NextResponse } from "next/server";
import { z } from "zod";
import { explainError, generateFromPhotos } from "@/lib/site/generate";
import { consumeAi } from "@/lib/site/limits";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/* « Photo → site » : l'IA lit la vitrine, la carte ou les produits et crée le site (compte comme une création). Coût ≈ 15 à 30 centimes. */

const Body = z.object({ photos: z.array(z.string().url().max(400)).min(1).max(4), note: z.string().trim().max(400).default("") });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ajoutez au moins une photo." }, { status: 400 });
  // Seulement des photos envoyées par ce compte (dossier à son nom chez SiteClic).
  const own = new RegExp(`^https://[a-z0-9]+\\.supabase\\.co/storage/v1/object/public/photos/${user.id}/`);
  if (!parsed.data.photos.every((u) => own.test(u))) return NextResponse.json({ error: "Photo invalide. Réessayez." }, { status: 400 });

  const limit = await consumeAi(supabase, user, "creation");
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: limit.subscribe ? 402 : 429 });

  try {
    const content = await generateFromPhotos(parsed.data.photos, parsed.data.note);
    const name = content.brand.name || "Mon site";
    const { data, error } = await supabase.from("sites").insert({ name, trade: content.hero.eyebrow.split("·")[0]?.trim() || "", content }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("Création par photo échouée", err);
    return NextResponse.json({ error: explainError(err, "La création a échoué. Réessayez dans un instant.") }, { status: 500 });
  }
}
