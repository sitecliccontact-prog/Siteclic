import { NextResponse } from "next/server";
import { z } from "zod";
import { ask } from "@/lib/site/generate";
import { safeBackground, safeSize } from "@/lib/site/colors";
import { reliefCredits } from "@/lib/site/relief-credits";
import { isTeam } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";

/* L'IA crée un relief de fond sur mesure (dégradés CSS uniquement, vérifiés). 1 € = 5 créations. */

export const maxDuration = 60;

const Body = z.object({ prompt: z.string().trim().min(3).max(300) });
const Out = z.object({
  label: z.string().describe("Nom court et élégant du relief, 1 à 3 mots, en français"),
  image: z.string().describe("Valeur CSS background-image : une liste de dégradés séparés par des virgules"),
  size: z.string().describe("Valeur CSS background-size correspondante (ex. « 40px 40px », ou « 100% 100% »), une par couche si besoin"),
});

const SYSTEM = `Tu es un designer web haut de gamme. Tu crées un fond décoratif (relief) pour le site d'un commerce, à partir de la demande du commerçant.
Règles strictes :
- Uniquement des fonctions CSS : linear-gradient, radial-gradient, conic-gradient et leurs versions repeating-, et color-mix(in srgb, …).
- Couleurs : utilise surtout les couleurs du site via var(--accent), var(--accent2), var(--ink), var(--bg), mélangées avec transparent grâce à color-mix(in srgb,var(--accent) 12%,transparent). Codes #hex autorisés seulement si la personne demande une couleur précise.
- Jamais d'url(), d'image, de guillemets, de point-virgule ni d'accolades.
- Le fond doit rester discret : opacité faible (entre 3 % et 20 %), pour que le texte reste parfaitement lisible. Élégant, jamais criard, jamais « fait par une IA ».
- 1 à 6 couches au maximum, moins de 1500 caractères.`;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Décrivez le relief en quelques mots." }, { status: 400 });

  const credits = await reliefCredits(supabase, user).catch(() => ({ unlimited: false, left: 0, buyable: false }));
  if (!credits.unlimited && credits.left <= 0) {
    return NextResponse.json({
      error: credits.buyable ? "Créez vos reliefs avec l'IA : 1 € pour 5 créations." : "La création de relief par l'IA arrive très bientôt.",
      needsPurchase: credits.buyable,
    }, { status: 402 });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await ask(Out, SYSTEM, `Demande du commerçant : ${parsed.data.prompt}${attempt ? "\n(Attention : respecte strictement les règles, uniquement des dégradés.)" : ""}`, "low", "eco");
      const image = safeBackground(out.image);
      if (!image) continue;
      if (!isTeam(user)) await supabase.rpc("relief_use");
      return NextResponse.json({ custom: { label: out.label.slice(0, 40), image, size: safeSize(out.size) }, left: credits.unlimited ? null : credits.left - 1 });
    } catch (err) {
      console.error("Relief IA", err);
      break;
    }
  }
  return NextResponse.json({ error: "L'IA n'a pas réussi ce relief. Essayez une autre description (rien n'a été décompté)." }, { status: 502 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  return NextResponse.json(await reliefCredits(supabase, user).catch(() => ({ unlimited: false, left: 0, buyable: false })));
}
