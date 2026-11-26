import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Marquer une carte cadeau comme utilisée (ou annuler ce marquage). */

const Body = z.object({ used: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const { data, error } = await supabase.from("gift_cards").update({ used_at: parsed.data.used ? new Date().toISOString() : null }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Impossible de modifier cette carte." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
