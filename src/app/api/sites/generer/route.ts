import { NextResponse } from "next/server";
import { BriefSchema, isOwnVideo } from "@/lib/site/schema";
import { generateSiteContent, explainError } from "@/lib/site/generate";
import { createClient } from "@/lib/supabase/server";
import { consumeAi } from "@/lib/site/limits";

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

  const limit = await consumeAi(supabase, user, "creation");
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: limit.subscribe ? 402 : 429 });

  try {
    const generated = await generateSiteContent(brief);
    const links = { instagram: brief.instagram, facebook: brief.facebook };
    const videoUrl = brief.video === "perso" && isOwnVideo(brief.videoUrl) ? brief.videoUrl : "";
    const content = {
      ...generated,
      ...(brief.instagram || brief.facebook ? { links } : {}),
      ...(brief.video !== "non" ? { video: { enabled: true, url: videoUrl } } : {}),
    };
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
