import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Option « Assistant IA » du site : formule active et conversations utilisées ce mois-ci. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connectez-vous." }, { status: 401 });
  const { data, error } = await supabase.rpc("assistant_offer", { p_site: id });
  if (error) return NextResponse.json({ ready: false, plan: null, quota: 0, used: 0 });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ready: true,
    plan: row?.plan ?? null,
    quota: row?.quota ?? 0,
    used: row?.used ?? 0,
    until: row?.active_until ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}
