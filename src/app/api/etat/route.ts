import { NextResponse } from "next/server";
import { z } from "zod";
import { ask, explainError } from "@/lib/site/generate";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Petit diagnostic : dit seulement si les réglages sont présents (jamais leur valeur).
 *  Avec ?test=ia (connecté), fait un tout petit essai avec l'IA. */
export async function GET(request: Request) {
  const base = {
    environnement: process.env.VERCEL_ENV ?? "local",
    branche: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    cleIA: Boolean(process.env.ANTHROPIC_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  };
  if (new URL(request.url).searchParams.get("test") !== "ia") return NextResponse.json(base);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ...base, testIA: "Connectez-vous d'abord à SiteClic." });
  const start = Date.now();
  try {
    const r = await ask(z.object({ ok: z.boolean() }), "Réponds simplement.", "Réponds ok = true.");
    return NextResponse.json({ ...base, testIA: r.ok ? "OK" : "réponse inattendue", secondes: Math.round((Date.now() - start) / 1000) });
  } catch (err) {
    console.error("Test IA échoué", err);
    return NextResponse.json({ ...base, testIA: explainError(err, "Échec"), secondes: Math.round((Date.now() - start) / 1000) });
  }
}
