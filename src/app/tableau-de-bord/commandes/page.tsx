import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ownAccount } from "@/lib/billing/connect";
import { stripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { OrdersBoard, type Gift, type Order } from "./OrdersBoard";

export const metadata: Metadata = { title: "Commandes · SiteClic" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: sites }, orders, gifts] = await Promise.all([
    supabase.from("sites").select("id, name"),
    supabase.from("orders").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(150),
    supabase.from("gift_cards").select("*").not("pay_session", "is", null).order("created_at", { ascending: false }).limit(150),
  ]);
  const names = Object.fromEntries((sites ?? []).map((s) => [s.id, s.name as string]));

  // Paiement en ligne : l'état réel est toujours relu chez Stripe (jamais seulement dans notre base).
  const acct = await ownAccount(user).catch(() => null);
  const paidOf = async (session: string | null) => {
    if (!session || !acct) return false;
    return stripe().checkout.sessions.retrieve(session, {}, { stripeAccount: acct.id }).then((s) => s.payment_status === "paid").catch(() => false);
  };
  const orderList: Order[] = await Promise.all((orders.data ?? []).map(async (o) => ({
    id: o.id, site: names[o.site_id] ?? "", name: o.name, phone: o.phone, pickup: o.pickup, items: o.items ?? [], total: o.total,
    note: o.note, status: o.status, created_at: o.created_at, online: Boolean(o.pay_session), paid: await paidOf(o.pay_session),
  })));
  const giftList: Gift[] = (await Promise.all((gifts.data ?? []).map(async (g) => ({
    id: g.id, site: names[g.site_id] ?? "", code: g.code, amount: g.amount, buyer: g.buyer, recipient: g.recipient,
    created_at: g.created_at, used: Boolean(g.used_at), paid: await paidOf(g.pay_session),
  })))).filter((g) => g.paid);

  return (
    <main className="min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <Link href="/tableau-de-bord" className="text-sm text-muted hover:text-ink">← Mes sites</Link>
      </header>
      <section className="rise mx-auto mt-10 max-w-3xl pb-20">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Tableau</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Commandes</h1>
        <p className="mt-3 text-muted">Les commandes à emporter et les cartes cadeaux achetées sur votre site. Quand une commande est prête, prévenez le client par SMS en un geste.</p>
        {orders.error && (
          <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Les commandes ne sont pas encore activées : ajoutez le code SQL n°13 dans Supabase (code BDD-{orders.error.code}).
          </p>
        )}
        <OrdersBoard orders={orderList} gifts={giftList} multiSite={(sites ?? []).length > 1} />
      </section>
    </main>
  );
}
