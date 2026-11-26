import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Code du jour de la carte de fidélité (à donner au client en caisse). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const { data, error } = await supabase.rpc("loyalty_code", { p_site: id });
  if (error) return NextResponse.json({ ready: false });
  return NextResponse.json({ ready: true, code: typeof data === "string" ? data : null }, { headers: { "Cache-Control": "no-store" } });
}
