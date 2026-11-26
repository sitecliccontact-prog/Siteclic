import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assistantReply, type Load } from "@/lib/site/assistant";
import { bookTable } from "@/lib/site/booking";
import { getPublishedSite } from "@/lib/site/published";
import { bookingEnabled, parseStoredContent, type SiteContent } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";
import { signVoice } from "@/lib/voice-server";

/** Réponse JSON ; une réponse de l'assistant est signée pour pouvoir être lue avec la voix naturelle. */
function out(body: { reply?: string } & Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body.reply ? { ...body, sig: signVoice(body.reply) } : body, init);
}

export const maxDuration = 60;

const Body = z.object({
  slug: z.string().max(120).optional(),
  /** Aperçu dans l'éditeur : le commerçant teste son propre site. */
  siteId: z.string().uuid().optional(),
  /** Identifiant de la conversation (compté une fois par mois dans l'option du commerçant). */
  conv: z.string().min(8).max(64).optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(1200) })).min(1).max(16),
});

const BUSY = "L'assistant est très demandé aujourd'hui. Pour toute question, appelez-nous directement.";
const FALLBACK = "Notre assistant n'est pas disponible pour le moment. Vous pouvez réserver avec le formulaire, c'est très rapide.";

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return out({ error: "Message invalide." }, { status: 400 });
  }
  const { slug, siteId, conv, messages } = parsed.data;
  const supabase = await createClient();

  let content: SiteContent | null = null;
  let liveSlug: string | null = null;
  if (siteId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return out({ error: "Connectez-vous pour tester l'assistant." }, { status: 401 });
    const { data } = await supabase.from("sites").select("content").eq("id", siteId).maybeSingle();
    content = parseStoredContent(data?.content);
  } else if (slug) {
    const site = await getPublishedSite(slug);
    // Assistant activé, ou réservation activée (bouton « Réserver en parlant »).
    if (site?.available && (site.content.assistant?.enabled || bookingEnabled(site.content))) {
      content = site.content;
      liveSlug = slug;
    }
  }
  if (!content) return out({ error: "L'assistant n'est pas disponible." }, { status: 404 });

  // Limites d'usage (protègent le crédit IA).
  if (!(slug?.startsWith("exemple-") && process.env.NODE_ENV !== "production")) {
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnu";
    const visitor = createHash("sha256").update(`${ip}|${request.headers.get("user-agent") ?? ""}`).digest("hex").slice(0, 32);
    if (liveSlug) {
      // Site en ligne : option payante du commerçant (Essentiel 300 / Pro 1000 conversations par mois).
      const { data: state, error } = await supabase.rpc("assistant_conv", { p_slug: liveSlug, p_conv: conv ?? "", p_visitor: visitor, p_kind: "msg" });
      if (error) console.error("Compteur des conversations indisponible", error);
      if (error || state === "off" || state === "quota") return out({ reply: FALLBACK, booked: false, fallback: true });
      if (state !== "ok") return out({ reply: BUSY, booked: false });
    } else {
      // Aperçu dans l'éditeur : le commerçant teste gratuitement, dans une petite limite par jour.
      const { data: ok, error } = await supabase.rpc("assistant_hit", { p_slug: `owner:${siteId}`, p_visitor: visitor });
      if (error) {
        console.error("Compteur de l'assistant indisponible", error);
        return out({ error: "L'assistant n'est pas encore activé." }, { status: 503 });
      }
      if (!ok) return out({ reply: BUSY, booked: false });
    }
  }

  try {
    const load = liveSlug ? await upcomingLoad(supabase, liveSlug) : [];
    const { reply, reservation } = await assistantReply(content, messages, load);
    if (!reservation) return out({ reply, booked: false });
    if (!liveSlug) {
      return out({ reply: `${reply} (Aperçu : sur votre site en ligne, cette réservation arrivera dans votre tableau.)`, booked: false });
    }
    const { error } = await bookTable(supabase, {
      slug: liveSlug, name: reservation.name, phone: reservation.phone, day: reservation.day, time: reservation.time,
      people: reservation.people, message: `${reservation.message ? `${reservation.message} · ` : ""}via l'assistant`, table: reservation.table,
    });
    if (error?.message?.includes("table_prise")) {
      return out({ reply: `Ah, la table ${reservation.table} vient d'être prise à cette heure-là. Je vous en propose une autre ?`, booked: false });
    }
    if (error) {
      console.error("Réservation par l'assistant impossible", error);
      const phone = content.contact.phone ? ` au ${content.contact.phone}` : "";
      return out({ reply: `Je n'ai pas pu enregistrer la réservation (vérifiez la date, l'heure et le téléphone). Vous pouvez aussi appeler${phone}.`, booked: false });
    }
    return out({ reply, booked: true });
  } catch (err) {
    console.error("Assistant en panne", err);
    return out({ error: "L'assistant ne répond pas pour le moment. Appelez-nous directement." }, { status: 500 });
  }
}

/** Réservations des 7 prochains jours (sans nom ni téléphone), pour que l'assistant sache ce qui est libre. */
async function upcomingLoad(supabase: Awaited<ReturnType<typeof createClient>>, slug: string): Promise<Load[]> {
  const days = Array.from({ length: 7 }, (_, k) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + k * 86400000)));
  const rows = await Promise.all(days.map(async (day) => {
    const { data, error } = await supabase.rpc("booking_load", { p_slug: slug, p_day: day });
    if (error || !Array.isArray(data)) return [];
    return (data as { at_time: string; people: number; table_label: string }[]).map((r) => ({ day, time: r.at_time, people: r.people, table: r.table_label }));
  }));
  return rows.flat();
}
