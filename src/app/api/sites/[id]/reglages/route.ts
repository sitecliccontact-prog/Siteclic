import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALLERGENS, bookingEnabled, isOwnVideo, parseStoredContent, type SiteContent } from "@/lib/site/schema";
import { ownAccount } from "@/lib/billing/connect";
import { SAMPLE_FLOOR } from "@/lib/site/floor";
import { publicPath } from "@/lib/site/slug";
import { createClient } from "@/lib/supabase/server";

/* Menu du jour, réservations, assistant, vidéo : visibles tout de suite sur le site en ligne, sans « Publier les modifications ».
   Gratuit (pas d'IA). */

const Body = z.object({
  special: z.object({ title: z.string().trim().max(80), text: z.string().trim().max(1200) }).nullable().optional(),
  booking: z.object({
    enabled: z.boolean().optional(),
    pay: z.object({ mode: z.enum(["aucun", "empreinte", "acompte"]), perPerson: z.number().min(0).max(500) }).optional(),
  }).optional(),
  assistant: z.object({ enabled: z.boolean().optional(), notes: z.string().max(3000).optional(), voice: z.enum(["homme", "femme"]).optional() }).optional(),
  floor: z.object({
    enabled: z.boolean(),
    tables: z.array(z.object({
      id: z.string().max(20), label: z.string().trim().min(1).max(20), seats: z.number().int().min(1).max(20),
      x: z.number().min(0).max(100), y: z.number().min(0).max(100), shape: z.enum(["rond", "carre", "long"]),
      zone: z.string().max(30).default(""),
    })).max(60),
  }).optional(),
  reviews: z.object({
    googleUrl: z.string().trim().max(400).refine((u) => !u || /^https:\/\/[^\s]+$/.test(u)),
    items: z.array(z.object({ name: z.string().trim().min(1).max(60), text: z.string().trim().min(1).max(400), stars: z.number().int().min(1).max(5) })).max(12),
  }).optional(),
  order: z.object({ enabled: z.boolean(), online: z.boolean() }).optional(),
  notice: z.object({ text: z.string().trim().min(1).max(200), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).nullable().optional(),
  loyalty: z.object({ enabled: z.boolean(), goal: z.number().int().min(3).max(20), reward: z.string().trim().min(1).max(80) }).optional(),
  appointments: z.object({
    enabled: z.boolean(),
    staff: z.array(z.string().trim().min(1).max(30)).max(10),
    services: z.array(z.object({ name: z.string().trim().min(1).max(60), minutes: z.number().int().min(10).max(480), price: z.string().trim().max(20) })).max(30),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    open: z.string().regex(/^[0-2]\d:[0-5]\d$/),
    close: z.string().regex(/^[0-2]\d:[0-5]\d$/),
  }).optional(),
  waitlist: z.object({ fullDay: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/) }).optional(),
  shop: z.object({
    enabled: z.boolean(),
    delivery: z.boolean(),
    deliveryNote: z.string().trim().max(120),
    products: z.array(z.object({
      name: z.string().trim().min(1).max(60), price: z.string().trim().min(1).max(20), description: z.string().trim().max(200),
      photo: z.string().max(400).refine((u) => !u || isOwnPhotoUrl(u)),
    })).max(30),
  }).optional(),
  events: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]{1,20}$/), title: z.string().trim().min(1).max(80), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^[0-2]\d:[0-5]\d$/), description: z.string().trim().max(400), price: z.string().trim().max(20), seats: z.number().int().min(0).max(2000),
  })).max(12).optional(),
  jobs: z.object({
    enabled: z.boolean(),
    items: z.array(z.object({ title: z.string().trim().min(1).max(60), kind: z.string().trim().max(30), text: z.string().trim().max(500) })).max(6),
  }).optional(),
  newsletter: z.object({ enabled: z.boolean(), perk: z.string().trim().max(100) }).optional(),
  allergens: z.record(z.string().max(120), z.array(z.enum(ALLERGENS)).max(14)).optional(),
  gift: z.object({ enabled: z.boolean(), amounts: z.array(z.number().int().min(10).max(500)).min(1).max(5) }).optional(),
  video: z.object({
    enabled: z.boolean(),
    url: z.string().max(400).refine((u) => !u || isOwnVideo(u)),
    clips: z.array(z.string().max(400).refine(isOwnVideo)).max(5).default([]),
  }).optional(),
});

/** Photos envoyées par le commerçant (hébergées chez SiteClic). */
function isOwnPhotoUrl(url: string) {
  return /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/photos\//.test(url);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Texte trop long ou invalide." }, { status: 400 });

  const { data: row } = await supabase.from("sites").select("content, published_content, status, slug").eq("id", id).maybeSingle();
  const content = parseStoredContent(row?.content);
  if (!row || !content) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  const patch: Partial<SiteContent> = {};
  if (parsed.data.special !== undefined) {
    const s = parsed.data.special;
    patch.special = s && s.text ? { title: s.title || "Menu du jour", text: s.text, date: new Date().toISOString() } : null;
  }
  if (parsed.data.booking) {
    const b = parsed.data.booking;
    const enabled = b.enabled ?? content.booking?.enabled ?? bookingEnabled(content);
    let pay = content.booking?.pay;
    if (b.pay) {
      // Le compte Stripe vient du compte vérifié du commerçant, jamais du navigateur.
      const acct = b.pay.mode === "aucun" ? null : await ownAccount(user).catch(() => null);
      pay = { mode: b.pay.mode, perPerson: Math.round(b.pay.perPerson), account: acct?.id };
    }
    patch.booking = { enabled, ...(pay ? { pay } : {}) };
    // Première activation : un plan de salle d'exemple, prêt à l'emploi (modifiable ensuite).
    if (b.enabled && !content.floor && !parsed.data.floor) patch.floor = { enabled: true, tables: SAMPLE_FLOOR };
  }
  if (parsed.data.assistant) {
    const a = parsed.data.assistant;
    patch.assistant = {
      enabled: a.enabled ?? content.assistant?.enabled ?? false,
      notes: a.notes ?? content.assistant?.notes ?? "",
      voice: a.voice ?? content.assistant?.voice ?? "femme",
    };
  }
  if (parsed.data.floor) patch.floor = parsed.data.floor;
  if (parsed.data.video) patch.video = parsed.data.video;
  if (parsed.data.reviews) patch.reviews = parsed.data.reviews;
  if (parsed.data.notice !== undefined) patch.notice = parsed.data.notice;
  if (parsed.data.loyalty) patch.loyalty = parsed.data.loyalty;
  if (parsed.data.appointments) patch.appointments = parsed.data.appointments;
  if (parsed.data.waitlist) patch.waitlist = parsed.data.waitlist;
  if (parsed.data.events) patch.events = [...parsed.data.events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (parsed.data.jobs) patch.jobs = parsed.data.jobs;
  if (parsed.data.newsletter) patch.newsletter = parsed.data.newsletter;
  if (parsed.data.allergens) patch.allergens = parsed.data.allergens;
  if (parsed.data.shop) {
    const acct = parsed.data.shop.enabled ? await ownAccount(user).catch(() => null) : null;
    patch.shop = { ...parsed.data.shop, account: acct?.id };
  }
  // Commande et cartes cadeaux : le compte Stripe vient du compte vérifié du commerçant, jamais du navigateur.
  if (parsed.data.order || parsed.data.gift) {
    const acct = (parsed.data.order?.online || parsed.data.gift?.enabled) ? await ownAccount(user).catch(() => null) : null;
    if (parsed.data.order) patch.order = { ...parsed.data.order, account: acct?.id };
    if (parsed.data.gift) patch.gift = { enabled: parsed.data.gift.enabled, amounts: [...new Set(parsed.data.gift.amounts)].sort((a, b) => a - b), account: acct?.id };
  }

  const next = { ...content, ...patch };
  const published = parseStoredContent(row.published_content);
  // On ne touche pas à updated_at : ce changement est déjà en ligne, pas besoin de « Publier les modifications ».
  const update: Record<string, unknown> = { content: next };
  if (published) update.published_content = { ...published, ...patch };

  const { error } = await supabase.from("sites").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  if (row.status === "en_ligne" && row.slug) {
    revalidatePath(publicPath(row.slug));
    revalidatePath(`${publicPath(row.slug)}/en`);
  }
  return NextResponse.json({ content: next });
}
