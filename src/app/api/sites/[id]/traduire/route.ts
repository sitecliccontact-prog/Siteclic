import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { explainError } from "@/lib/site/generate";
import { consumeAi } from "@/lib/site/limits";
import { parseStoredContent } from "@/lib/site/schema";
import { publicPath } from "@/lib/site/slug";
import { translateToEnglish } from "@/lib/site/translate";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/** « Mon site en anglais » : traduit une fois la version en ligne et la garde (compte comme 1 modification IA). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  const { data: row } = await supabase.from("sites").select("content, published_content, status, slug").eq("id", id).maybeSingle();
  const content = parseStoredContent(row?.content);
  if (!row || !content) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });
  const published = parseStoredContent(row.published_content);

  const limit = await consumeAi(supabase, user, "modification");
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: 429 });

  try {
    const translations = { en: await translateToEnglish(published ?? content), enAt: new Date().toISOString() };
    const next = { ...content, translations };
    const update: Record<string, unknown> = { content: next };
    if (published) update.published_content = { ...published, translations };
    const { error } = await supabase.from("sites").update(update).eq("id", id);
    if (error) throw error;
    if (row.status === "en_ligne" && row.slug) {
      revalidatePath(publicPath(row.slug));
      revalidatePath(`${publicPath(row.slug)}/en`);
    }
    return NextResponse.json({ content: next });
  } catch (err) {
    console.error("Traduction échouée", err);
    return NextResponse.json({ error: explainError(err, "La traduction a échoué. Réessayez dans un instant.") }, { status: 500 });
  }
}
