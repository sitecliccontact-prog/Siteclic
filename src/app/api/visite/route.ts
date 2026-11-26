import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Compte une visite sur un site en ligne (statistiques du commerçant, sans donnée personnelle). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return new NextResponse(null, { status: 204 });
  if (/bot|crawl|spider|preview/i.test(request.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  const supabase = await createClient();
  await supabase.rpc("visit_hit", { p_slug: slug });
  return new NextResponse(null, { status: 204 });
}
