import { NextResponse } from "next/server";
import { z } from "zod";
import { editSiteContent, explainError } from "@/lib/site/generate";
import { parseStoredContent } from "@/lib/site/schema";
import { requireSubscription } from "@/lib/billing/guard";
import { consumeAi } from "@/lib/site/limits";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const Body = z.object({ instruction: z.string().trim().min(2).max(1500) });

/** Modifie le site à partir d'une demande écrite (« on ferme à 19h le samedi »). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  // Réservé aux abonnés.
  const blocked = await requireSubscription(user);
  if (blocked) return blocked;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Écrivez ce que vous voulez changer." }, { status: 400 });

  const { data: row } = await supabase.from("sites").select("content").eq("id", id).maybeSingle();
  const current = parseStoredContent(row?.content);
  if (!current) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  // Non abonnés (dont la période gratuite actuelle) : nombre limité de modifications par l'IA.
  const limit = await consumeAi(supabase, user, "modification");
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: 429 });

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
    const message = explainError(err, "La modification a échoué. Réessayez dans un instant.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
