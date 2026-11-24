import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assistantReply } from "@/lib/site/assistant";
import { getPublishedSite } from "@/lib/site/published";
import { parseStoredContent, type SiteContent } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const Body = z.object({
  slug: z.string().max(120).optional(),
  /** Aperçu dans l'éditeur : le commerçant teste son propre site. */
  siteId: z.string().uuid().optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(1200) })).min(1).max(16),
});

const BUSY = "L'assistant est très demandé aujourd'hui. Pour toute question, appelez-nous directement.";

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }
  const { slug, siteId, messages } = parsed.data;
  const supabase = await createClient();

  let content: SiteContent | null = null;
  let liveSlug: string | null = null;
  if (siteId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Connectez-vous pour tester l'assistant." }, { status: 401 });
    const { data } = await supabase.from("sites").select("content").eq("id", siteId).maybeSingle();
    content = parseStoredContent(data?.content);
  } else if (slug) {
    const site = await getPublishedSite(slug);
    if (site?.available && site.content.assistant?.enabled) {
      content = site.content;
      liveSlug = slug;
    }
  }
  if (!content) return NextResponse.json({ error: "L'assistant n'est pas disponible." }, { status: 404 });

  // Limite d'usage (protège le crédit IA) : par site et par visiteur.
  const visitorKey = siteId ? `owner:${siteId}` : slug!;
  if (!(slug?.startsWith("exemple-") && process.env.NODE_ENV !== "production")) {
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnu";
    const visitor = createHash("sha256").update(`${ip}|${request.headers.get("user-agent") ?? ""}`).digest("hex").slice(0, 32);
    const { data: ok, error } = await supabase.rpc("assistant_hit", { p_slug: visitorKey, p_visitor: visitor });
    if (error) {
      console.error("Compteur de l'assistant indisponible", error);
      return NextResponse.json({ error: "L'assistant n'est pas encore activé." }, { status: 503 });
    }
    if (!ok) return NextResponse.json({ reply: BUSY, booked: false });
  }

  try {
    const { reply, reservation } = await assistantReply(content, messages);
    if (!reservation) return NextResponse.json({ reply, booked: false });
    if (!liveSlug) {
      return NextResponse.json({ reply: `${reply} (Aperçu : sur votre site en ligne, cette réservation arrivera dans votre tableau.)`, booked: false });
    }
    const { error } = await supabase.rpc("request_reservation", {
      p_slug: liveSlug, p_name: reservation.name, p_phone: reservation.phone, p_day: reservation.day,
      p_time: reservation.time, p_people: reservation.people, p_message: `${reservation.message ? `${reservation.message} · ` : ""}via l'assistant`,
    });
    if (error) {
      console.error("Réservation par l'assistant impossible", error);
      const phone = content.contact.phone ? ` au ${content.contact.phone}` : "";
      return NextResponse.json({ reply: `Je n'ai pas pu enregistrer la réservation (vérifiez la date, l'heure et le téléphone). Vous pouvez aussi appeler${phone}.`, booked: false });
    }
    return NextResponse.json({ reply, booked: true });
  } catch (err) {
    console.error("Assistant en panne", err);
    return NextResponse.json({ error: "L'assistant ne répond pas pour le moment. Appelez-nous directement." }, { status: 500 });
  }
}
