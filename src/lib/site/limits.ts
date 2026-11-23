import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 5 créations ou imports par jour et par compte, pour maîtriser les coûts. */
export async function dailyLimitReached(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from("sites").select("id", { count: "exact", head: true }).gte("created_at", since);
  return (count ?? 0) >= 5;
}
