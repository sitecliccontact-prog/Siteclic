import { NextResponse } from "next/server";
import { z } from "zod";
import { explainError, generateFromImport } from "@/lib/site/generate";
import { importSite, ImportError } from "@/lib/site/importer";
import { preparePhotos, type PreparedPhoto } from "@/lib/site/import-photos";
import { requireSubscription } from "@/lib/billing/guard";
import { createClient } from "@/lib/supabase/server";
import { consumeAi, creationBlocked } from "@/lib/site/limits";

export const maxDuration = 300;

const Body = z.object({ url: z.string().min(4).max(300) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  // Réservé aux abonnés.
  const blocked = await requireSubscription(user);
  if (blocked) return blocked;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indiquez l'adresse de votre site." }, { status: 400 });

  const limit = await creationBlocked(supabase, user);
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: limit.subscribe ? 402 : 429 });

  try {
    const imported = await importSite(parsed.data.url);
    const photos = await preparePhotos(imported.images);
    // On ne compte l'essai qu'au moment d'utiliser l'IA (une adresse invalide ne coûte rien).
    const used = await consumeAi(supabase, user, "import");
    if (used) return NextResponse.json({ error: used.message, needsSubscription: used.subscribe }, { status: used.subscribe ? 402 : 429 });
    const content = await generateFromImport(imported, photos);
    content.photos = await rehost(supabase, user.id, content.photos, photos);
    const { data, error } = await supabase
      .from("sites")
      .insert({
        name: content.brand.name,
        trade: content.hero.eyebrow.split("·")[0]?.trim() || null,
        brief: { source: "import", url: imported.url },
        content,
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("Import échoué", err);
    const message = err instanceof ImportError ? err.message : explainError(err, "L'import a échoué. Réessayez dans un instant.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Copie les photos choisies chez nous : elles restent nettes, rapides et ne disparaissent pas si l'ancien site change. */
async function rehost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chosen: string[],
  prepared: PreparedPhoto[],
): Promise<string[]> {
  const stamp = Date.now().toString(36);
  return Promise.all(
    chosen.map(async (url, i) => {
      const photo = prepared.find((p) => p.url === url);
      if (!photo) return url;
      const path = `${userId}/import-${stamp}/${i + 1}.webp`;
      const { error } = await supabase.storage.from("photos").upload(path, photo.data, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) {
        console.error("Copie de photo impossible", error.message);
        return url;
      }
      return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
    }),
  );
}
