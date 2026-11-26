import "server-only";
import { verifiedAccount } from "./connect";
import { billingEnabled } from "./stripe";

/** Compte Stripe du restaurant prêt à encaisser, vérifié (appartient bien au propriétaire du site). */
export async function shopAccount(account: string | undefined, ownerId: string | undefined) {
  if (!billingEnabled() || !account || !ownerId) return null;
  const acct = await verifiedAccount(account, ownerId);
  return acct?.charges_enabled ? acct : null;
}
