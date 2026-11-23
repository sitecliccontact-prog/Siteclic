import { NextResponse } from "next/server";
import { billingEnabled, getOrCreateCustomer, stripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

/** Ouvre l'espace Stripe où le client change sa carte, voit ses factures ou résilie. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Le paiement n'est pas encore ouvert." }, { status: 503 });
  try {
    const customer = await getOrCreateCustomer(supabase, user);
    const session = await stripe().billingPortal.sessions.create({
      customer,
      locale: "fr",
      return_url: `${new URL(request.url).origin}/tableau-de-bord`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Espace abonnement Stripe impossible", err);
    return NextResponse.json({ error: "Impossible d'ouvrir votre espace abonnement. Réessayez dans un instant." }, { status: 500 });
  }
}
