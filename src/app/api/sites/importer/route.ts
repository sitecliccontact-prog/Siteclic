import { NextResponse } from "next/server";
import { z } from "zod";
import { generateFromImport, GenerationError } from "@/lib/site/generate";
import { importSite, ImportError } from "@/lib/site/importer";
import { requireSubscription } from "@/lib/billing/guard";
import { createClient } from "@/lib/supabase/server";
import { dailyLimitReached } from "@/lib/site/limits";

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

  if (await dailyLimitReached(supabase)) {
    return NextResponse.json({ error: "Vous avez déjà créé 5 sites aujourd'hui. Revenez demain." }, { status: 429 });
  }

  try {
    const imported = await importSite(parsed.data.url);
    const content = await generateFromImport(imported);
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
    const message =
      err instanceof ImportError || err instanceof GenerationError
        ? err.message
        : "L'import a échoué. Réessayez dans un instant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
