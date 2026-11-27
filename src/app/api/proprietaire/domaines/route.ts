import { NextResponse } from "next/server";
import { z } from "zod";
import { isTeam } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";

/* Propriétaire : marque une demande de nom de domaine comme branchée (actif) ou indisponible. */

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isTeam(user)) return NextResponse.json({ error: "Réservé au propriétaire." }, { status: 403 });
  const b = z.object({ id: z.string().uuid(), status: z.enum(["demande", "actif", "refuse"]) }).safeParse(await request.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const { error } = await supabase.rpc("domain_set_status", { p_id: b.data.id, p_status: b.data.status });
  if (error) return NextResponse.json({ error: "Impossible pour le moment." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
