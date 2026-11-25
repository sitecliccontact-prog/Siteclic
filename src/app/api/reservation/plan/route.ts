import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Tables déjà réservées un jour donné, pour griser le plan de salle (aucune donnée personnelle). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const day = url.searchParams.get("day") ?? "";
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ taken: [] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_load", { p_slug: slug, p_day: day });
  if (error || !Array.isArray(data)) return NextResponse.json({ taken: [] });
  const taken = (data as { at_time: string; table_label: string }[])
    .filter((r) => r.table_label)
    .map((r) => ({ time: r.at_time, table: r.table_label }));
  return NextResponse.json({ taken }, { headers: { "Cache-Control": "no-store" } });
}
