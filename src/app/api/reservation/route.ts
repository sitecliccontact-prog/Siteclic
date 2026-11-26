import { NextResponse } from "next/server";
import { z } from "zod";
import { bookTable } from "@/lib/site/booking";
import { createClient } from "@/lib/supabase/server";
import { verifiedAccount } from "@/lib/billing/connect";
import { billingEnabled, stripe } from "@/lib/billing/stripe";
import { BOOKING_FEE } from "@/lib/pricing";
import { getPublishedSite } from "@/lib/site/published";

/* Demande de réservation envoyée depuis le site public d'un commerçant. */

const Body = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^[0-2]\d:[0-5]\d$/),
  people: z.coerce.number().int().min(1).max(30),
  message: z.string().trim().max(500).default(""),
  table: z.string().trim().max(20).default(""),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez votre nom, votre téléphone, la date et l'heure." }, { status: 400 });
  const b = parsed.data;
  const supabase = await createClient();
  const { error } = await bookTable(supabase, b);
  if (!error) {
    // Garantie demandée par le restaurant : on envoie le client chez Stripe (empreinte bancaire ou acompte).
    const payUrl = await guarantee(request, supabase, b).catch((err) => { console.error("Garantie Stripe impossible", err); return null; });
    return NextResponse.json({ ok: true, payUrl });
  }
  const msg = error.message ?? "";
  if (msg.includes("table_prise")) return NextResponse.json({ error: "Cette table vient d'être réservée à cette heure-là. Choisissez-en une autre." }, { status: 409 });
  if (msg.includes("reservation_trop")) return NextResponse.json({ error: "Beaucoup de demandes aujourd'hui : merci d'appeler directement." }, { status: 429 });
  if (msg.includes("reservation_invalide")) return NextResponse.json({ error: "Vérifiez la date (aujourd'hui ou plus tard), l'heure et votre téléphone." }, { status: 400 });
  console.error("Réservation impossible", error);
  return NextResponse.json({ error: "La réservation en ligne n'est pas disponible pour le moment. Merci d'appeler directement." }, { status: 503 });
}

type Body = z.infer<typeof Body>;

/** Crée la page de paiement Stripe (sur le compte du restaurant) et la relie à la réservation. Renvoie son adresse, ou null. */
async function guarantee(request: Request, supabase: Awaited<ReturnType<typeof createClient>>, b: Body): Promise<string | null> {
  if (!billingEnabled()) return null;
  const site = await getPublishedSite(b.slug);
  const pay = site?.content.booking?.pay;
  if (!site || !pay || pay.mode === "aucun" || !pay.account || pay.perPerson <= 0) return null;
  const acct = await verifiedAccount(pay.account, site.ownerId ?? "");
  if (!acct?.charges_enabled) return null;
  const opts = { stripeAccount: acct.id };
  const origin = new URL(request.url).origin;
  const amount = Math.round(pay.perPerson * 100) * b.people;
  const brand = site.content.brand.name;
  const when = `${b.day.split("-").reverse().join("/")} à ${b.time.replace(":", "h")}`;
  const back = `${origin}/s/${b.slug}`;
  let session;
  if (pay.mode === "empreinte") {
    const customer = await stripe().customers.create({ name: b.name, phone: b.phone }, opts);
    session = await stripe().checkout.sessions.create({
      mode: "setup",
      currency: "eur",
      customer: customer.id,
      locale: "fr",
      setup_intent_data: { description: `Garantie de réservation ${brand} · ${b.people} pers. le ${when}` },
      custom_text: { submit: { message: `Rien n'est débité. En cas d'absence sans prévenir, ${brand} pourra prélever ${pay.perPerson} € par personne.` } },
      success_url: `${back}?paiement=ok#reserver`,
      cancel_url: `${back}?paiement=annule#reserver`,
      metadata: { slug: b.slug, day: b.day, time: b.time, people: String(b.people) },
    }, opts);
  } else {
    session = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      line_items: [{ quantity: b.people, price_data: { currency: "eur", unit_amount: Math.round(pay.perPerson * 100), product_data: { name: `Acompte réservation ${brand} · ${when}` } } }],
      payment_intent_data: { application_fee_amount: Math.round(amount * BOOKING_FEE), description: `Acompte ${brand} · ${b.people} pers. le ${when}` },
      success_url: `${back}?paiement=ok#reserver`,
      cancel_url: `${back}?paiement=annule#reserver`,
      metadata: { slug: b.slug, day: b.day, time: b.time, people: String(b.people) },
    }, opts);
  }
  await supabase.rpc("attach_reservation_payment", {
    p_slug: b.slug, p_phone: b.phone, p_day: b.day, p_time: b.time, p_session: session.id, p_mode: pay.mode, p_amount: amount,
  });
  return session.url;
}
