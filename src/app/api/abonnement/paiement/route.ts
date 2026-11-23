import { NextResponse } from "next/server";
import { z } from "zod";
import { billingEnabled, getOrCreateCustomer, PRICE_CENTS, safeReturn, stripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ retour: z.string().max(300).optional() });

/** Ouvre la page de paiement sécurisée Stripe pour l'abonnement. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Le paiement n'est pas encore ouvert." }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  const retour = safeReturn(parsed.success ? parsed.data.retour : undefined);
  const origin = new URL(request.url).origin;

  try {
    const customer = await getOrCreateCustomer(supabase, user);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      locale: "fr",
      allow_promotion_codes: true,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: PRICE_CENTS,
          recurring: { interval: "month" },
          product_data: { name: "Abonnement SiteClic", description: "Site en ligne, modifications par l'IA, import de votre site actuel." },
        },
      }],
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${origin}/abonnement/merci?retour=${encodeURIComponent(retour)}`,
      cancel_url: `${origin}/abonnement?retour=${encodeURIComponent(retour)}`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Paiement Stripe impossible", err);
    return NextResponse.json({ error: "Le paiement n'a pas pu s'ouvrir. Réessayez dans un instant." }, { status: 500 });
  }
}
