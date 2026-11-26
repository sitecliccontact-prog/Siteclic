import "server-only";
import type { User } from "@supabase/supabase-js";
import { billingEnabled, stripe } from "./stripe";

/* Stripe Connect : chaque restaurant relie son propre compte Stripe pour encaisser l'empreinte ou l'acompte
   de ses clients. SiteClic prend 2 % sur chaque paiement (application fee). */

/** Vérifie qu'un compte Stripe Connect appartient bien à ce compte SiteClic (metadata.user_id). */
export async function verifiedAccount(id: unknown, userId: string) {
  if (!billingEnabled() || typeof id !== "string" || !/^acct_[A-Za-z0-9]{6,40}$/.test(id)) return null;
  try {
    const acct = await stripe().accounts.retrieve(id);
    return acct.metadata?.user_id === userId ? acct : null;
  } catch {
    return null;
  }
}

/** Le compte du commerçant, ou null. */
export function ownAccount(user: User) {
  return verifiedAccount(user.user_metadata?.stripe_connect_id, user.id);
}

export type ConnectState = { enabled: boolean; connected: boolean; ready: boolean; account: string | null };

export async function connectState(user: User): Promise<ConnectState> {
  if (!billingEnabled()) return { enabled: false, connected: false, ready: false, account: null };
  const acct = await ownAccount(user);
  return { enabled: true, connected: Boolean(acct), ready: Boolean(acct?.charges_enabled), account: acct?.id ?? null };
}
