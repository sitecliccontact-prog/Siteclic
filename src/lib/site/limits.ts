import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { billingEnabled, getSubscription } from "@/lib/billing/stripe";

/* Limites d'utilisation de l'IA, pour protéger le crédit IA.
   Le compteur est dans la table ai_usage (supabase/05-limites-ia.sql) : les clients ne peuvent pas l'effacer. */

/** Compte non abonné : sites créés ou importés par l'IA, au total. */
export const FREE_SITES = 2;
/** Compte non abonné : modifications par l'IA, au total. */
export const FREE_EDITS = 10;
/* Abonnés : pas de limite pour l'instant (choix du 23/11, la formule de prix peut changer). */

/** Comptes de l'équipe SiteClic : jamais bloqués. */
export { isTeam } from "@/lib/team";
import { isTeam } from "@/lib/team";

async function isPaying(user: User) {
  if (!billingEnabled()) return false;
  return (await getSubscription(user).catch(() => null))?.active ?? false;
}

type Kind = "creation" | "import" | "modification";
type Counts = { total: number; last_day: number; last_month: number };
export type Blocked = { message: string; subscribe: boolean };

const NOT_READY: Blocked = {
  message: "L'IA est momentanément indisponible (compteur d'utilisation non activé, code BDD-LIMITES). Réessayez plus tard.",
  subscribe: false,
};

function verdict(kind: Kind, paying: boolean, c: Counts): Blocked | null {
  if (paying) return null;
  if (kind === "modification") {
    return c.total > FREE_EDITS
      ? { message: `Vous avez utilisé vos ${FREE_EDITS} modifications gratuites par l'IA. Vous pouvez toujours modifier votre site vous-même (onglet « Modifier moi-même »).`, subscribe: true }
      : null;
  }
  return c.total > FREE_SITES
    ? { message: `Vous avez déjà créé ${FREE_SITES} sites gratuits. Pour en créer d'autres, choisissez un site à 20 € ou le pack 5 sites à 50 €. Vous pouvez toujours modifier vos sites existants.`, subscribe: true }
    : null;
}

/** Pour l'affichage : le compte peut-il encore créer un site ? (sans rien compter) */
export async function creationBlocked(supabase: SupabaseClient, user: User): Promise<Blocked | null> {
  if (isTeam(user)) return null;
  const paying = await isPaying(user);
  if (paying) return null;
  const { data, error } = await supabase.rpc("ai_use_counts", { p_kind: "creation" }).single<Counts>();
  if (error || !data) return NOT_READY;
  // +1 : on regarde si une création de plus serait acceptée.
  const next = { total: data.total + 1, last_day: data.last_day + 1, last_month: data.last_month + 1 };
  // Les sites créés avant la mise en place du compteur comptent aussi.
  const { count } = await supabase.from("sites").select("id", { count: "exact", head: true });
  next.total = Math.max(next.total, (count ?? 0) + 1);
  return verdict("creation", paying, next);
}

/** À appeler juste avant d'utiliser l'IA : note l'utilisation, ou renvoie pourquoi c'est refusé. */
export async function consumeAi(supabase: SupabaseClient, user: User, kind: Kind): Promise<Blocked | null> {
  if (isTeam(user)) return null;
  const paying = await isPaying(user);
  if (paying) return null;
  if (kind !== "modification") {
    const { count } = await supabase.from("sites").select("id", { count: "exact", head: true });
    if ((count ?? 0) >= FREE_SITES) return verdict(kind, false, { total: FREE_SITES + 1, last_day: 0, last_month: 0 });
  }
  const { data, error } = await supabase.rpc("record_ai_use", { p_kind: kind }).single<Counts>();
  if (error || !data) {
    console.error("Compteur IA indisponible", error);
    return NOT_READY;
  }
  return verdict(kind, paying, data);
}
