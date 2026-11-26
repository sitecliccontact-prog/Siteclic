import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Le commerçant fait avancer une commande à emporter (seulement les siennes, protégé par la base). */

const Body = z.object({ status: z.enum(["nouvelle", "prete", "retiree", "annulee"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const { data, error } = await supabase.from("orders").update({ status: parsed.data.status }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Impossible de modifier cette commande." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Impossible de supprimer." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
