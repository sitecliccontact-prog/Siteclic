import { NextResponse } from "next/server";
import { z } from "zod";
import { billingEnabled, getOrCreateCustomer, safeReturn, stripe } from "@/lib/billing/stripe";
import { HOSTING, OFFERS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  retour: z.string().max(300).optional(),
  offer: z.enum(["site", "pack5"]).default("site"),
  hosting: z.enum(["an", "mois"]).default("an"),
});

/** Ouvre la page de paiement sécurisée Stripe : le site (paiement unique) + l'hébergement (à l'année ou au mois). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Le paiement n'est pas encore ouvert." }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  const b = parsed.success ? parsed.data : Body.parse({});
  const retour = safeReturn(b.retour);
  const origin = new URL(request.url).origin;
  const offer = OFFERS.find((o) => o.id === b.offer) ?? OFFERS[0];
  const yearly = b.hosting === "an";

  try {
    const customer = await getOrCreateCustomer(supabase, user);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      locale: "fr",
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: offer.cents,
            product_data: { name: `SiteClic · ${offer.name}`, description: offer.features.join(" · ") },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: yearly ? HOSTING.yearCents : HOSTING.monthCents,
            recurring: { interval: yearly ? "year" : "month" },
            product_data: { name: "Hébergement SiteClic", description: "Votre site en ligne, rapide et sécurisé. Sans engagement." },
          },
        },
      ],
      subscription_data: { metadata: { user_id: user.id, offer: offer.id, hosting: b.hosting } },
      success_url: `${origin}/abonnement/merci?retour=${encodeURIComponent(retour)}`,
      cancel_url: `${origin}/abonnement?retour=${encodeURIComponent(retour)}`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Paiement Stripe impossible", err);
    return NextResponse.json({ error: "Le paiement n'a pas pu s'ouvrir. Réessayez dans un instant." }, { status: 500 });
  }
}
