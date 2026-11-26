import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Le site a-t-il l'assistant IA en ce moment ? (option du commerçant active et limite du mois pas atteinte) */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return NextResponse.json({ ok: false });
  if (slug.startsWith("exemple-") && process.env.NODE_ENV !== "production") return NextResponse.json({ ok: true });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assistant_status", { p_slug: slug });
  // Tant que le SQL 10 n'est pas installé : on garde l'ancien fonctionnement (assistant disponible, avec limites par jour).
  const missing = error && /assistant_status|PGRST202|42883/.test(`${error.code} ${error.message}`);
  return NextResponse.json({ ok: missing ? true : !error && data === true }, { headers: { "Cache-Control": "no-store" } });
}
