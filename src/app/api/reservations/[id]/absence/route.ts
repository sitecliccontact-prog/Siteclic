import { NextResponse } from "next/server";
import { ownAccount } from "@/lib/billing/connect";
import { billingEnabled, stripe } from "@/lib/billing/stripe";
import { BOOKING_FEE } from "@/lib/pricing";
import { parseStoredContent } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

/* Le client n'est pas venu : le restaurant prélève le montant prévu sur la carte enregistrée (empreinte bancaire).
   SiteClic garde 2 %. */

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ error: "Le paiement en ligne n'est pas encore activé." }, { status: 503 });

  const { data: r } = await supabase.from("reservations").select("id, site_id, people, pay_session, pay_mode, pay_charged, day").eq("id", id).maybeSingle();
  if (!r) return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
  if (r.pay_mode !== "empreinte" || !r.pay_session) return NextResponse.json({ error: "Aucune carte enregistrée pour cette réservation." }, { status: 400 });
  if (r.pay_charged > 0) return NextResponse.json({ error: "L'absence a déjà été facturée." }, { status: 409 });

  const { data: site } = await supabase.from("sites").select("content").eq("id", r.site_id).maybeSingle();
  const content = parseStoredContent(site?.content);
  const perPerson = content?.booking?.pay?.perPerson ?? 0;
  const acct = await ownAccount(user);
  if (!acct || perPerson <= 0) return NextResponse.json({ error: "Reliez d'abord votre compte Stripe et réglez le montant par personne." }, { status: 400 });
  const opts = { stripeAccount: acct.id };

  try {
    const session = await stripe().checkout.sessions.retrieve(r.pay_session, { expand: ["setup_intent"] }, opts);
    const si = session.setup_intent;
    const pm = si && typeof si !== "string" ? si.payment_method : null;
    const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!pm || !customer || (si && typeof si !== "string" && si.status !== "succeeded")) {
      return NextResponse.json({ error: "Le client n'a pas enregistré sa carte pour cette réservation." }, { status: 400 });
    }
    const amount = Math.round(perPerson * 100) * r.people;
    const pi = await stripe().paymentIntents.create({
      amount,
      currency: "eur",
      customer,
      payment_method: typeof pm === "string" ? pm : pm.id,
      off_session: true,
      confirm: true,
      application_fee_amount: Math.round(amount * BOOKING_FEE),
      description: `Absence non prévenue · réservation du ${r.day}`,
    }, { ...opts, idempotencyKey: `absence-${r.id}` });
    if (pi.status !== "succeeded" && pi.status !== "processing") {
      return NextResponse.json({ error: "La carte a été refusée." }, { status: 402 });
    }
    await supabase.from("reservations").update({ pay_charged: amount }).eq("id", r.id);
    return NextResponse.json({ ok: true, amount });
  } catch (err) {
    console.error("Prélèvement absence", err);
    const msg = err && typeof err === "object" && "code" in err && err.code === "card_declined" ? "La carte a été refusée." : "Le prélèvement n'a pas pu être fait.";
    return NextResponse.json({ error: msg }, { status: 402 });
  }
}
