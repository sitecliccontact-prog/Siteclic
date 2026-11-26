import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { billingEnabled, getOrCreateCustomer, stripe } from "@/lib/billing/stripe";
import { RELIEF_PACK } from "@/lib/pricing";
import { isTeam } from "@/lib/team";

/** Créations de relief restantes. Achats relus chez Stripe (impossible à falsifier), créations comptées en base. */
export async function reliefCredits(supabase: SupabaseClient, user: User): Promise<{ unlimited: boolean; left: number; buyable: boolean }> {
  if (isTeam(user)) return { unlimited: true, left: 999, buyable: false };
  if (!billingEnabled()) return { unlimited: false, left: 0, buyable: false };
  const customer = await getOrCreateCustomer(supabase, user);
  const sessions = await stripe().checkout.sessions.list({ customer, limit: 100 });
  const bought = sessions.data.filter((s) => s.metadata?.kind === "relief" && s.payment_status === "paid").length;
  const { data: used } = await supabase.rpc("relief_count");
  return { unlimited: false, left: Math.max(0, bought * RELIEF_PACK.tries - (typeof used === "number" ? used : 0)), buyable: true };
}
