import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Le commerçant confirme, refuse ou supprime une demande (protégé : seulement ses propres sites). */

const Body = z.object({ status: z.enum(["nouvelle", "confirmee", "refusee"]) });

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const { data, error } = await supabase.from("reservations").update({ status: parsed.data.status, seen: true }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Impossible de modifier cette réservation." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Impossible de supprimer." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
