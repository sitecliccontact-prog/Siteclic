import { NextResponse } from "next/server";
import { z } from "zod";
import { SiteContentSchema } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ content: SiteContentSchema });

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
