import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { StoredContentSchema } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ content: StoredContentSchema });

/** Enregistre les modifications faites à la main dans l'éditeur. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  const content = parsed.data.content;

  const { data, error } = await supabase
    .from("sites")
    .update({ content, name: content.brand.name || "Mon site", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Supprime définitivement un site (et ses photos). Les réservations et commandes liées partent avec lui. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  const { data, error } = await supabase.from("sites").delete().eq("id", id).select("slug").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Suppression impossible. Réessayez dans un instant." }, { status: 404 });
  if (data.slug) revalidatePath(`/s/${data.slug}`);

  // Photos du site : on fait le ménage (sans bloquer si ça échoue).
  const folder = `${user.id}/${id}`;
  const { data: files } = await supabase.storage.from("photos").list(folder, { limit: 100 }).catch(() => ({ data: null }));
  if (files?.length) await supabase.storage.from("photos").remove(files.map((f) => `${folder}/${f.name}`)).catch(() => null);
  return NextResponse.json({ ok: true });
}
