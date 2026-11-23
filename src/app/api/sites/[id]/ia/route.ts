import { NextResponse } from "next/server";
import { z } from "zod";
import { editSiteContent, GenerationError } from "@/lib/site/generate";
import { parseStoredContent } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const Body = z.object({ instruction: z.string().trim().min(2).max(1000) });

/** Modifie le site à partir d'une demande écrite (« on ferme à 19h le samedi »). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Écrivez ce que vous voulez changer." }, { status: 400 });

  const { data: row } = await supabase.from("sites").select("content").eq("id", id).maybeSingle();
  const current = parseStoredContent(row?.content);
  if (!current) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  try {
    const { reply, content } = await editSiteContent(current, parsed.data.instruction);
    const { error } = await supabase
      .from("sites")
      .update({ content, name: content.brand.name || "Mon site", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ reply, content });
  } catch (err) {
    console.error("Modification IA échouée", err);
    const message = err instanceof GenerationError ? err.message : "La modification a échoué. Réessayez dans un instant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
