import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { billingEnabled, getSubscription } from "@/lib/billing/stripe";

/** Nombre de sites qu'un compte non abonné peut créer avec l'IA (pour maîtriser les coûts). */
export const FREE_SITES = 2;
/** Créations ou imports par jour pour un abonné. */
const DAILY_LIMIT = 5;

/** Comptes de l'équipe SiteClic : jamais bloqués (tests). */
const TEAM_EMAIL = /^siteclic\.contact(\+[^@]*)?@gmail\.com$/i;

export function isTeam(user: User) {
  return TEAM_EMAIL.test(user.email ?? "");
}

async function isPaying(user: User) {
  if (!billingEnabled()) return false;
  return (await getSubscription(user).catch(() => null))?.active ?? false;
}

/** Message d'explication si le compte ne peut plus créer de site, sinon null. */
export async function creationBlocked(supabase: SupabaseClient, user: User): Promise<{ message: string; subscribe: boolean } | null> {
  if (isTeam(user)) return null;
  if (await isPaying(user)) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase.from("sites").select("id", { count: "exact", head: true }).gte("created_at", since);
    return (count ?? 0) >= DAILY_LIMIT
      ? { message: `Vous avez déjà créé ${DAILY_LIMIT} sites aujourd'hui. Revenez demain, ou modifiez un site existant.`, subscribe: false }
      : null;
  }
  const { count } = await supabase.from("sites").select("id", { count: "exact", head: true });
  return (count ?? 0) >= FREE_SITES
    ? {
        message: `Vous avez déjà créé ${FREE_SITES} sites gratuits. Pour en créer d'autres, passez à l'abonnement SiteClic. Vous pouvez toujours modifier vos sites existants.`,
        subscribe: true,
      }
    : null;
}
