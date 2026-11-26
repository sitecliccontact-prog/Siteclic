import type { User } from "@supabase/supabase-js";

/** Comptes de l'équipe SiteClic (propriétaire) : tout est débloqué, sans limite ni paiement. */
const TEAM_EMAIL = /^siteclic\.contact(\+[^@]*)?@gmail\.com$/i;

export function isTeam(user: Pick<User, "email"> | null | undefined) {
  return TEAM_EMAIL.test(user?.email ?? "");
}
