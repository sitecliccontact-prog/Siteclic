import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { parseStoredContent } from "@/lib/site/schema";
import { publicPath, slugify } from "@/lib/site/slug";
import { requireSubscription } from "@/lib/billing/guard";
import { verifiedCustomerOf } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { freePublishAllowed } from "@/lib/app-settings";

type Row = { id: string; name: string; content: unknown; slug: string | null };

/** Met le site en ligne (ou publie les dernières modifications). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  // Réservé aux abonnés.
  const blocked = await requireSubscription(user);
  if (blocked) return blocked;
  // Paiement pas encore ouvert : pas de mise en ligne gratuite (sauf comptes du propriétaire ou s'il l'autorise).
  if (!(await freePublishAllowed(user))) {
    return NextResponse.json({ error: "La mise en ligne ouvre très bientôt, avec le paiement en ligne. Votre site est bien enregistré : vous pouvez continuer à le préparer." }, { status: 403 });
  }

  const { data } = await supabase.from("sites").select("id, name, content, slug").eq("id", id).maybeSingle();
  const site = data as Row | null;
  const content = parseStoredContent(site?.content);
  if (!site || !content) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  const base = site.slug ?? slugify(content.brand.name || site.name);
  const now = new Date().toISOString();
  // On garde le client Stripe sur le site : s'il résilie, son site sera retiré à la fin de la période payée.
  const billingCustomer = await verifiedCustomerOf(user);
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = site.slug ?? (attempt === 0 ? base : attempt < 5 ? `${base}-${attempt + 1}` : `${base}-${Math.random().toString(36).slice(2, 6)}`);
    const { error } = await supabase
      .from("sites")
      .update({ slug, status: "en_ligne", published_content: content, published_at: now, ...(billingCustomer ? { billing_customer: billingCustomer } : {}) })
      .eq("id", id);
    if (!error) {
      revalidatePath(publicPath(slug));
      return NextResponse.json({ slug, path: publicPath(slug), publishedAt: now });
    }
    if (error.code !== "23505" || site.slug) break; // 23505 = adresse déjà prise par un autre site
  }
  return NextResponse.json({ error: "La mise en ligne n'a pas fonctionné. Réessayez dans un instant." }, { status: 500 });
}

/** Retire le site d'Internet (il reste dans « Mes sites »). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const { data, error } = await supabase.from("sites").update({ status: "apercu" }).eq("id", id).select("slug").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Impossible de retirer le site." }, { status: 500 });
  if (data.slug) revalidatePath(publicPath(data.slug));
  return NextResponse.json({ ok: true });
}
