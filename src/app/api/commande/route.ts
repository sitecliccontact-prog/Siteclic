import { NextResponse } from "next/server";
import { z } from "zod";
import { shopAccount } from "@/lib/billing/shop";
import { stripe } from "@/lib/billing/stripe";
import { BOOKING_FEE } from "@/lib/pricing";
import { getPublishedSite } from "@/lib/site/published";
import { priceCents } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

/* Commande à emporter depuis le site d'un restaurant. Les prix sont relus sur la carte publiée (jamais ceux du navigateur). */

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  pickup: z.string().regex(/^[0-2]\d:[0-5]\d$/),
  note: z.string().trim().max(300).default(""),
  items: z.array(z.object({ key: z.string().regex(/^\d{1,2}-\d{1,3}$/), qty: z.number().int().min(1).max(20) })).min(1).max(40),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez votre nom, votre téléphone et l'heure de retrait." }, { status: 400 });
  const b = parsed.data;
  const site = await getPublishedSite(b.slug);
  if (!site?.available || !site.content.order?.enabled) return NextResponse.json({ error: "La commande en ligne n'est pas disponible." }, { status: 404 });

  const lines: { name: string; qty: number; price: number }[] = [];
  for (const { key, qty } of b.items) {
    const [ci, ii] = key.split("-").map(Number);
    const it = site.content.offer.categories[ci]?.items[ii];
    const price = it ? priceCents(it.price) : null;
    if (!it || !price) return NextResponse.json({ error: "La carte a changé : rechargez la page." }, { status: 409 });
    lines.push({ name: it.name, qty, price });
  }
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("place_order", {
    p_slug: b.slug, p_name: b.name, p_phone: b.phone, p_pickup: b.pickup, p_items: lines, p_total: total, p_note: b.note,
  });
  if (error || typeof orderId !== "string") {
    if (error?.message?.includes("commande_trop")) return NextResponse.json({ error: "Beaucoup de commandes aujourd'hui : merci d'appeler directement." }, { status: 429 });
    console.error("Commande impossible", error);
    return NextResponse.json({ error: "La commande en ligne n'est pas disponible pour le moment. Merci d'appeler." }, { status: 503 });
  }

  // Paiement en ligne si le restaurant l'a activé et que son compte Stripe est prêt.
  const acct = site.content.order.online ? await shopAccount(site.content.order.account, site.ownerId).catch(() => null) : null;
  if (!acct) return NextResponse.json({ ok: true });
  try {
    const back = `${new URL(request.url).origin}/s/${b.slug}`;
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      line_items: lines.map((l) => ({ quantity: l.qty, price_data: { currency: "eur", unit_amount: l.price, product_data: { name: l.name } } })),
      payment_intent_data: { application_fee_amount: Math.round(total * BOOKING_FEE), description: `Commande à emporter · ${b.name} · ${b.pickup}` },
      metadata: { order: orderId, slug: b.slug },
      success_url: `${back}?commande=ok#commander`,
      cancel_url: `${back}?commande=annule#commander`,
    }, { stripeAccount: acct.id });
    await supabase.rpc("attach_order_payment", { p_order: orderId, p_session: session.id });
    return NextResponse.json({ ok: true, payUrl: session.url });
  } catch (err) {
    console.error("Paiement commande", err);
    return NextResponse.json({ ok: true });
  }
}
