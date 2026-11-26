import { NextResponse } from "next/server";
import { z } from "zod";
import { shopAccount } from "@/lib/billing/shop";
import { stripe } from "@/lib/billing/stripe";
import { BOOKING_FEE } from "@/lib/pricing";
import { getPublishedSite } from "@/lib/site/published";
import { createClient } from "@/lib/supabase/server";

/* Achat d'une carte cadeau (paiement sur le compte Stripe du restaurant, 2 % pour SiteClic). */

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  amount: z.number().int().min(10).max(500),
  buyer: z.string().trim().min(1).max(80),
  recipient: z.string().trim().min(1).max(80),
  message: z.string().trim().max(300).default(""),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indiquez de la part de qui et pour qui." }, { status: 400 });
  const b = parsed.data;
  const site = await getPublishedSite(b.slug);
  const gift = site?.content.gift;
  if (!site?.available || !gift?.enabled || !gift.amounts.includes(b.amount)) return NextResponse.json({ error: "Carte cadeau indisponible." }, { status: 404 });
  const acct = await shopAccount(gift.account, site.ownerId).catch(() => null);
  if (!acct) return NextResponse.json({ error: "Le paiement des cartes cadeaux n'est pas encore activé." }, { status: 503 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_gift", { p_slug: b.slug, p_amount: b.amount * 100, p_buyer: b.buyer, p_recipient: b.recipient, p_message: b.message });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    console.error("Carte cadeau", error);
    return NextResponse.json({ error: "Carte cadeau indisponible pour le moment." }, { status: 503 });
  }
  try {
    const back = `${new URL(request.url).origin}/s/${b.slug}`;
    const cents = b.amount * 100;
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: cents, product_data: { name: `Carte cadeau ${site.content.brand.name} · ${b.amount} €` } } }],
      payment_intent_data: { application_fee_amount: Math.round(cents * BOOKING_FEE), description: `Carte cadeau pour ${b.recipient}` },
      metadata: { gift: row.id, slug: b.slug },
      success_url: `${back}/cadeau?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}#cadeau`,
    }, { stripeAccount: acct.id });
    await supabase.rpc("attach_gift_payment", { p_gift: row.id, p_session: session.id });
    return NextResponse.json({ payUrl: session.url });
  } catch (err) {
    console.error("Paiement carte cadeau", err);
    return NextResponse.json({ error: "Le paiement n'a pas pu s'ouvrir. Réessayez." }, { status: 502 });
  }
}
