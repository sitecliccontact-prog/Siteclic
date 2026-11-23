import "server-only";
import Stripe from "stripe";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Prix de l'abonnement (en centimes) : 29 €/mois. */
export const PRICE_CENTS = 2900;
export const PRICE_LABEL = "29 €/mois";

let client: Stripe | null = null;

/** Vrai quand la clé Stripe est réglée dans Vercel (STRIPE_SECRET_KEY). */
export function billingEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY manquante");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export type Subscription = {
  active: boolean;
  status: string | null;
  /** Date de fin de la période payée (ou de fin si résilié). */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const NONE: Subscription = { active: false, status: null, periodEnd: null, cancelAtPeriodEnd: false };

/** Vérifie qu'un client Stripe appartient bien à ce compte SiteClic. */
async function verifiedCustomer(id: unknown, userId: string): Promise<string | null> {
  if (typeof id !== "string" || !id.startsWith("cus_")) return null;
  try {
    const customer = await stripe().customers.retrieve(id);
    if (customer.deleted || customer.metadata?.user_id !== userId) return null;
    return customer.id;
  } catch {
    return null;
  }
}

/** Le client Stripe du compte, seulement s'il appartient bien à ce compte. */
function ownCustomerId(user: User) {
  return verifiedCustomer(user.user_metadata?.stripe_customer_id, user.id);
}

/** Trouve ou crée le client Stripe lié au compte SiteClic. */
export async function getOrCreateCustomer(supabase: SupabaseClient, user: User): Promise<string> {
  const existing = await ownCustomerId(user);
  if (existing) return existing;
  const customer = await stripe().customers.create({
    email: user.email,
    name: (user.user_metadata?.shop_name as string) || undefined,
    metadata: { user_id: user.id },
  });
  await supabase.auth.updateUser({ data: { stripe_customer_id: customer.id } });
  return customer.id;
}

/** État de l'abonnement, lu directement chez Stripe (impossible à falsifier depuis l'appli). */
export async function getSubscription(user: User): Promise<Subscription> {
  if (!billingEnabled()) return { ...NONE, active: true, status: "gratuit_pour_le_moment" };
  return readSubscription(await ownCustomerId(user));
}

/** Pour un site publié : son propriétaire est-il toujours abonné ? */
export async function ownerIsSubscribed(customerId: unknown, userId: string): Promise<boolean> {
  if (!billingEnabled()) return true;
  return (await readSubscription(await verifiedCustomer(customerId, userId))).active;
}

/** Le client Stripe vérifié du compte (pour l'enregistrer sur un site publié). */
export async function verifiedCustomerOf(user: User) {
  return billingEnabled() ? ownCustomerId(user) : null;
}

async function readSubscription(customerId: string | null): Promise<Subscription> {
  if (!customerId) return NONE;
  const subs = await stripe().subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const sub = subs.data.find((s) => ACTIVE.includes(s.status)) ?? subs.data[0];
  if (!sub) return NONE;
  const end = sub.items.data[0]?.current_period_end;
  return {
    active: ACTIVE.includes(sub.status),
    status: sub.status,
    periodEnd: end ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
  };
}

const ACTIVE: string[] = ["active", "trialing", "past_due"];

/** Réponse envoyée quand une action est réservée aux abonnés. */
export const SUBSCRIPTION_REQUIRED = {
  error: "Cette action est réservée aux abonnés SiteClic.",
  needsSubscription: true,
} as const;

/** Adresse de retour sûre (uniquement une page de l'appli). */
export function safeReturn(path: string | null | undefined, fallback = "/tableau-de-bord") {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
}
