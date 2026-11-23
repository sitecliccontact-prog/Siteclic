import { NextResponse } from "next/server";
import { BriefSchema } from "@/lib/site/schema";
import { generateSiteContent, explainError } from "@/lib/site/generate";
import { createClient } from "@/lib/supabase/server";
import { creationBlocked } from "@/lib/site/limits";

export const maxDuration = 300; // la création peut prendre jusqu'à une minute ou deux

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  const parsed = BriefSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Certaines réponses sont manquantes." }, { status: 400 });
  }
  const brief = parsed.data;

  const limit = await creationBlocked(supabase, user);
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: limit.subscribe ? 402 : 429 });

  try {
    const content = await generateSiteContent(brief);
    const { data, error } = await supabase
      .from("sites")
      .insert({ name: brief.name, trade: brief.trade, brief, content })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("Création de site échouée", err);
    const message = explainError(err, "La création a échoué. Réessayez dans un instant.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
