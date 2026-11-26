import { NextResponse } from "next/server";
import { billingEnabled, getOrCreateCustomer, safeReturn, stripe } from "@/lib/billing/stripe";
import { RELIEF_PACK } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

/** Achat de 5 créations de relief par l'IA pour 1 €. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Le paiement arrive très bientôt." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const retour = safeReturn(typeof body?.retour === "string" ? body.retour : undefined);
  const origin = new URL(request.url).origin;
  try {
    const customer = await getOrCreateCustomer(supabase, user);
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer,
      locale: "fr",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: RELIEF_PACK.cents, product_data: { name: `Reliefs créés par l'IA · ${RELIEF_PACK.tries} créations` } } }],
      metadata: { kind: "relief", user_id: user.id },
      success_url: `${origin}${retour}`,
      cancel_url: `${origin}${retour}`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Achat relief", err);
    return NextResponse.json({ error: "Impossible d'ouvrir le paiement. Réessayez." }, { status: 502 });
  }
}
