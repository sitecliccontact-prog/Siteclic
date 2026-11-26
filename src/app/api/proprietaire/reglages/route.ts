import { NextResponse } from "next/server";
import { z } from "zod";
import { isTeam } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";

/* Réglages du propriétaire : essai gratuit, budget IA gratuit par jour, mise en ligne gratuite (vérifié aussi par la base). */

const Body = z.object({
  free_trial: z.boolean(),
  free_budget_cents: z.number().int().min(0).max(100000),
  free_publish: z.boolean(),
  max_per_ip_day: z.number().int().min(1).max(50),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isTeam(user)) return NextResponse.json({ error: "Réservé au propriétaire." }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valeurs invalides." }, { status: 400 });
  const b = parsed.data;
  const { error } = await supabase.rpc("app_settings_set", { p_free_trial: b.free_trial, p_budget: b.free_budget_cents, p_free_publish: b.free_publish, p_ip_max: b.max_per_ip_day });
  if (error) return NextResponse.json({ error: "Enregistrement impossible (texte SQL 14 ajouté ?)." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
