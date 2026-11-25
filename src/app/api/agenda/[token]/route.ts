import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

/* Agenda privé d'un commerçant, au format standard des calendriers (.ics).
   Il s'ajoute une fois dans Google Agenda ou sur iPhone, puis les réservations y apparaissent toutes seules. */

export const dynamic = "force-dynamic";

type Row = { site_name: string; id: string; day: string; at_time: string; people: number; name: string; phone: string; message: string; status: string; table_label: string };

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** « 2026-11-25 » + « 20:30 » + décalage en minutes → « 20261125T203000 » (heure de Paris). */
function stamp(day: string, time: string, plus = 0) {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, min + plus));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Lien d'agenda invalide.", { status: 404 });
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("agenda_feed", { p_token: token });
  if (error) return new Response("Agenda indisponible.", { status: 503 });
  const rows = (data ?? []) as Row[];
  const name = rows[0]?.site_name ?? "SiteClic";
  const now = stamp(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(11, 16));
  const events = rows.map((r) => [
    "BEGIN:VEVENT",
    `UID:${r.id}@siteclic`,
    `DTSTAMP:${now}Z`,
    `DTSTART;TZID=Europe/Paris:${stamp(r.day, r.at_time)}`,
    `DTEND;TZID=Europe/Paris:${stamp(r.day, r.at_time, 120)}`,
    `SUMMARY:${esc(`${r.status === "confirmee" ? "" : "À confirmer · "}${r.people} pers. · ${r.name}${r.table_label ? ` · table ${r.table_label}` : ""}`)}`,
    `DESCRIPTION:${esc([`Téléphone : ${r.phone}`, r.message && `Message : ${r.message}`, r.table_label && `Table : ${r.table_label}`, `Réservation SiteClic (${r.status === "confirmee" ? "confirmée" : "à confirmer"})`].filter(Boolean).join("\n"))}`,
    `STATUS:${r.status === "confirmee" ? "CONFIRMED" : "TENTATIVE"}`,
    "END:VEVENT",
  ].join("\r\n"));
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SiteClic//Reservations//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`Réservations ${name}`)}`, "X-WR-TIMEZONE:Europe/Paris", "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M",
    ...events, "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
