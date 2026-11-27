import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Parrainage : code du commerçant (GET) et lien d'un parrain utilisé à l'inscription (POST). */

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const { data, error } = await supabase.rpc("my_referral");
  if (error) return NextResponse.json({ error: "Parrainage indisponible." }, { status: 503 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const code = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9]{6}$/) }).safeParse(await request.json().catch(() => null));
  if (!code.success) return NextResponse.json({ result: "inconnu" });
  const { data } = await supabase.rpc("claim_referral", { p_code: code.data.code });
  return NextResponse.json({ result: data ?? "erreur" });
}
