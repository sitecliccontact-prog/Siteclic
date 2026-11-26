import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bookingEnabled, isOwnVideo, parseStoredContent, type SiteContent } from "@/lib/site/schema";
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
  video: z.object({
    enabled: z.boolean(),
    url: z.string().max(400).refine((u) => !u || isOwnVideo(u)),
    clips: z.array(z.string().max(400).refine(isOwnVideo)).max(5).default([]),
  }).optional(),
});

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

  const next = { ...content, ...patch };
  const published = parseStoredContent(row.published_content);
  // On ne touche pas à updated_at : ce changement est déjà en ligne, pas besoin de « Publier les modifications ».
  const update: Record<string, unknown> = { content: next };
  if (published) update.published_content = { ...published, ...patch };

  const { error } = await supabase.from("sites").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  if (row.status === "en_ligne" && row.slug) revalidatePath(publicPath(row.slug));
  return NextResponse.json({ content: next });
}
