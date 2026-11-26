import type { User } from "@supabase/supabase-js";

/** Comptes de l'équipe SiteClic (propriétaire) : tout est débloqué, sans limite ni paiement.
    L'e-mail doit être confirmé (sinon n'importe qui pourrait s'inscrire avec siteclic.contact+xxx). */
const TEAM_EMAIL = /^siteclic\.contact(\+[^@]*)?@gmail\.com$/i;

export function isTeam(user: Pick<User, "email" | "email_confirmed_at"> | null | undefined) {
  return TEAM_EMAIL.test(user?.email ?? "") && Boolean(user?.email_confirmed_at);
}
