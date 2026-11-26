import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifiedAccount } from "@/lib/billing/connect";
import { billingEnabled, stripe } from "@/lib/billing/stripe";
import { getPublishedSite } from "@/lib/site/published";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre carte cadeau", robots: { index: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ session?: string }> };

/** Après le paiement : la carte cadeau, prête à imprimer ou à envoyer (le paiement est vérifié chez Stripe). */
export default async function GiftPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { session } = await searchParams;
  const site = await getPublishedSite(slug);
  if (!site || !session || !/^cs_[A-Za-z0-9_]{10,200}$/.test(session) || !billingEnabled()) notFound();
  const account = site.content.gift?.account;
  const acct = account && site.ownerId ? await verifiedAccount(account, site.ownerId).catch(() => null) : null;
  if (!acct) notFound();
  const paid = await stripe().checkout.sessions.retrieve(session, {}, { stripeAccount: acct.id }).then((s) => s.payment_status === "paid").catch(() => false);
  const supabase = await createClient();
  const { data } = paid ? await supabase.rpc("gift_by_session", { p_session: session }) : { data: null };
  const gift = Array.isArray(data) ? data[0] : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b0b0d] px-5 py-10 text-[#f5f4f0]">
      {gift ? (
        <div className="w-full max-w-md">
          <div className="gift-card relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1612] via-[#0f0e0d] to-[#2a1a10] p-7 shadow-2xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#ff5b1f]/25 blur-3xl" />
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Carte cadeau</p>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight">{gift.site_name}</p>
            <p className="mt-8 text-6xl font-bold tracking-tight">{Math.round(gift.amount / 100)} €</p>
            {gift.recipient && <p className="mt-6 text-white/80">Pour {gift.recipient}</p>}
            {gift.message && <p className="mt-2 italic leading-relaxed text-white/60">« {gift.message} »</p>}
            <div className="mt-8 flex items-end justify-between border-t border-white/10 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Code</p>
                <p className="font-mono text-xl tracking-[0.2em]">{gift.code}</p>
              </div>
              <p className="text-right text-[11px] text-white/40">À présenter sur place<br />Valable 1 an</p>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-white/60">Merci ! Imprimez cette carte ou faites une capture d&apos;écran pour l&apos;offrir.</p>
          <div className="mt-4 flex justify-center gap-3 print:hidden">
            <PrintButton />
            <a href={`/s/${slug}`} className="rounded-full border border-white/20 px-5 py-2.5 text-sm">Retour au site</a>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="font-display text-2xl font-bold">Paiement en cours de vérification</p>
          <p className="mt-3 text-white/60">Rechargez cette page dans quelques secondes.</p>
          <a href={`/s/${slug}`} className="mt-6 inline-block text-sm underline underline-offset-4">Retour au site</a>
        </div>
      )}
    </main>
  );
}
