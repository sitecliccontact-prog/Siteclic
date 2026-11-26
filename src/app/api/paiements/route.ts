import { NextResponse } from "next/server";
import { connectState, ownAccount } from "@/lib/billing/connect";
import { billingEnabled, safeReturn, stripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

/* Compte Stripe du restaurant (pour encaisser l'empreinte bancaire / l'acompte de ses clients). */

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connectez-vous." }, { status: 401 });
  return NextResponse.json(await connectState(user).catch(() => ({ enabled: true, connected: false, ready: false, account: null })));
}

/** Ouvre l'inscription Stripe du restaurant (pièce d'identité, IBAN… remplis chez Stripe, jamais chez nous). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connectez-vous." }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Le paiement en ligne arrive très bientôt." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const retour = safeReturn(typeof body?.retour === "string" ? body.retour : undefined);
  const origin = new URL(request.url).origin;
  try {
    let acct = await ownAccount(user);
    if (!acct) {
      acct = await stripe().accounts.create({
        type: "express",
        country: "FR",
        email: user.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { product_description: "Réservations de restaurant (empreinte bancaire, acomptes)" },
        metadata: { user_id: user.id },
      });
      await supabase.auth.updateUser({ data: { stripe_connect_id: acct.id } });
    }
    const link = await stripe().accountLinks.create({
      account: acct.id,
      type: "account_onboarding",
      refresh_url: `${origin}${retour}`,
      return_url: `${origin}${retour}`,
    });
    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("Stripe Connect", err);
    return NextResponse.json({ error: "Impossible d'ouvrir Stripe pour le moment. Réessayez." }, { status: 502 });
  }
}
