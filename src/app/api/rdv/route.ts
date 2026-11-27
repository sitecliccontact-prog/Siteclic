import { after, NextResponse } from "next/server";
import { notifyOwner, whenLabel } from "@/lib/push";
import { z } from "zod";
import { getPublishedSite } from "@/lib/site/published";
import { createClient } from "@/lib/supabase/server";

/* Prise de rendez-vous (coiffeurs, instituts…) : créneaux déjà pris (GET) et réservation d'un créneau (POST). */

const Slug = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slug = Slug.safeParse(q.get("slug"));
  const day = Day.safeParse(q.get("day"));
  if (!slug.success || !day.success) return NextResponse.json({ busy: [] });
  const supabase = await createClient();
  const { data } = await supabase.rpc("appointment_busy", { p_slug: slug.data, p_day: day.data });
  return NextResponse.json({ busy: Array.isArray(data) ? data : [] }, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({
  slug: Slug,
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  day: Day,
  time: z.string().regex(/^[0-2]\d:[0-5]\d$/),
  service: z.number().int().min(0).max(29),
  staff: z.string().trim().max(30).default(""),
  message: z.string().trim().max(300).default(""),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez votre nom, votre téléphone et le créneau." }, { status: 400 });
  const b = parsed.data;
  const site = await getPublishedSite(b.slug);
  const a = site?.content.appointments;
  const service = a?.services[b.service];
  if (!site?.available || !a?.enabled || !service) return NextResponse.json({ error: "La prise de rendez-vous n'est pas disponible." }, { status: 404 });
  if (b.staff && !a.staff.includes(b.staff)) return NextResponse.json({ error: "Choisissez une personne de l'équipe." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_appointment", {
    p_slug: b.slug, p_name: b.name, p_phone: b.phone, p_day: b.day, p_time: b.time,
    p_service: service.name, p_staff: b.staff, p_minutes: service.minutes, p_message: b.message,
  });
  if (!error) {
    after(() => notifyOwner(b.slug, { title: "Nouveau rendez-vous", body: `${b.name} · ${service.name}, ${whenLabel(b.day, b.time)}${b.staff ? ` avec ${b.staff}` : ""}`, url: "/tableau-de-bord/reservations", tag: "rdv" }));
    return NextResponse.json({ ok: true });
  }
  const m = error.message ?? "";
  if (m.includes("creneau_pris")) return NextResponse.json({ error: "Ce créneau vient d'être pris. Choisissez-en un autre." }, { status: 409 });
  if (m.includes("reservation_trop")) return NextResponse.json({ error: "Beaucoup de demandes aujourd'hui : merci d'appeler directement." }, { status: 429 });
  if (m.includes("rdv_invalide")) return NextResponse.json({ error: "Vérifiez la date (aujourd'hui ou plus tard) et votre téléphone." }, { status: 400 });
  console.error("Rendez-vous impossible", error);
  return NextResponse.json({ error: "La prise de rendez-vous n'est pas disponible pour le moment. Merci d'appeler." }, { status: 503 });
}
