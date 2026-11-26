import { NextResponse } from "next/server";
import { z } from "zod";
import { ask, explainError } from "@/lib/site/generate";
import { consumeAi } from "@/lib/site/limits";
import { parseStoredContent } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/* Posts Instagram prêts à poster : l'IA écrit 3 idées (titre de l'image + légende + hashtags), l'image est montée sur le téléphone.
   Compte comme 1 modification IA (≈ 1 à 2 centimes). */

const Posts = z.object({
  posts: z.array(z.object({
    headline: z.string().describe("Texte posé sur la photo : 2 à 6 mots, élégant, sans emoji, sans point final"),
    kicker: z.string().describe("Petite ligne au-dessus du titre, 1 à 3 mots, ex. « Ce midi », « Nouveauté », « Ce week-end »"),
    caption: z.string().describe("Légende Instagram : 2 à 4 phrases courtes et chaleureuses, 1 ou 2 emojis maximum, avec une invitation à venir ou réserver"),
    hashtags: z.array(z.string()).describe("6 à 10 hashtags sans #, dont la ville et le métier"),
    photo: z.number().int().describe("Numéro de la photo du site qui va le mieux (0 = la première) ; 0 si aucune"),
  })).describe("Exactement 3 posts différents"),
});

const Body = z.object({ idea: z.string().trim().max(300).default("") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  const { data: row } = await supabase.from("sites").select("content").eq("id", id).maybeSingle();
  const c = parseStoredContent(row?.content);
  if (!c) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  const limit = await consumeAi(supabase, user, "modification");
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: 429 });

  const info = {
    nom: c.brand.name, accroche: c.brand.tagline, metier: c.hero.eyebrow, presentation: c.about.paragraphs.join(" "),
    points_forts: c.highlights.map((h) => h.title), carte: c.offer.categories.map((k) => ({ categorie: k.name, produits: k.items.slice(0, 6).map((i) => `${i.name} ${i.price}`) })),
    menu_du_jour: c.special?.text ?? "", photos: c.photos.length,
  };
  try {
    const out = await ask(
      Posts,
      "Tu es le community manager d'un commerce de proximité haut de gamme. Tu écris des posts Instagram sobres et élégants, jamais racoleurs, sans majuscules partout, sans exagération. Tu t'appuies uniquement sur les vraies informations du commerce. Français naturel, vouvoiement pour le lecteur.",
      `<commerce>${JSON.stringify(info)}</commerce>\n${parsed.success && parsed.data.idea ? `<idee_du_commercant>${parsed.data.idea}</idee_du_commercant>` : "Propose 3 posts variés (un produit phare, l'ambiance du lieu, une invitation à venir)."}`,
      "low",
      "eco",
    );
    const posts = out.posts.slice(0, 3).map((p) => ({ ...p, photo: Math.min(Math.max(0, p.photo), Math.max(0, c.photos.length - 1)), hashtags: p.hashtags.slice(0, 10).map((h) => h.replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean) }));
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("Posts Instagram", err);
    return NextResponse.json({ error: explainError(err, "L'IA n'a pas pu écrire les posts. Réessayez.") }, { status: 500 });
  }
}
