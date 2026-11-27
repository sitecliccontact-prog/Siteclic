import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Nom de domaine : le commerçant demande son adresse (ex. monresto.fr). SiteClic l'achète et la branche (sous 48 h). */

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("domain_requests").select("domain, status").eq("site_id", id).maybeSingle();
  return NextResponse.json({ request: data ?? null });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const body = z.object({ domain: z.string().trim().min(4).max(120) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Écrivez l'adresse voulue, par exemple monresto.fr" }, { status: 400 });
  const { data, error } = await supabase.rpc("domain_request", { p_site: id, p_domain: body.data.domain });
  if (!error) return NextResponse.json({ request: { domain: data, status: "demande" } });
  const m = error.message ?? "";
  if (m.includes("domaine_invalide")) return NextResponse.json({ error: "Cette adresse n'est pas valide. Exemple : monresto.fr" }, { status: 400 });
  if (m.includes("domaine_pris")) return NextResponse.json({ error: "Cette adresse est déjà demandée par un autre commerce." }, { status: 409 });
  if (m.includes("domaine_actif")) return NextResponse.json({ error: "Votre adresse est déjà active." }, { status: 409 });
  console.error("Domaine", error);
  return NextResponse.json({ error: "Demande impossible pour le moment. (code Supabase n°4 à passer ?)" }, { status: 503 });
}
