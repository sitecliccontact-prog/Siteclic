import { after, NextResponse } from "next/server";
import { z } from "zod";
import { notifyOwner, whenLabel } from "@/lib/push";
import { getPublishedSite } from "@/lib/site/published";
import { createClient } from "@/lib/supabase/server";

/* Événements et soirées : places restantes (GET) et réservation d'une place (POST, revérifiée dans la base). */

const Slug = z.string().regex(/^[a-z0-9-]{1,60}$/);

export async function GET(request: Request) {
  const slug = Slug.safeParse(new URL(request.url).searchParams.get("slug"));
  if (!slug.success) return NextResponse.json({ taken: {} });
  const supabase = await createClient();
  const { data } = await supabase.rpc("event_seats", { p_slug: slug.data });
  const taken = Object.fromEntries(((data ?? []) as { event_id: string; taken: number }[]).map((r) => [r.event_id, r.taken]));
  return NextResponse.json({ taken }, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({
  slug: Slug,
  event: z.string().regex(/^[a-z0-9]{1,20}$/),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  people: z.coerce.number().int().min(1).max(20),
  message: z.string().trim().max(300).default(""),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez votre nom, votre téléphone et le nombre de places." }, { status: 400 });
  const b = parsed.data;
  const site = await getPublishedSite(b.slug);
  const ev = site?.content.events?.find((e) => e.id === b.event);
  if (!site?.available || !ev) return NextResponse.json({ error: "Cet événement n'est plus proposé." }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_event", { p_slug: b.slug, p_event: b.event, p_name: b.name, p_phone: b.phone, p_people: b.people, p_message: b.message });
  if (!error) {
    after(() => notifyOwner(b.slug, { title: `Réservation · ${ev.title}`, body: `${b.name}, ${b.people} place(s), ${whenLabel(ev.date, ev.time)}`, url: "/tableau-de-bord/reservations", tag: "evenement" }));
    return NextResponse.json({ ok: true, left: typeof data === "number" ? data : -1 });
  }
  const m = error.message ?? "";
  const left = /complet:(\d+)/.exec(m);
  if (left) return NextResponse.json({ error: Number(left[1]) > 0 ? `Il ne reste que ${left[1]} place(s).` : "C'est complet, désolé !" }, { status: 409 });
  if (m.includes("evenement_passe")) return NextResponse.json({ error: "Cet événement est déjà passé." }, { status: 410 });
  if (m.includes("reservation_trop")) return NextResponse.json({ error: "Beaucoup de demandes aujourd'hui : merci d'appeler directement." }, { status: 429 });
  console.error("Événement", error);
  return NextResponse.json({ error: "La réservation n'est pas disponible pour le moment. Merci d'appeler." }, { status: 503 });
}
