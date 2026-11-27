import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTo, serverKey } from "@/lib/push";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

/* Rapport du lundi : appelé chaque lundi matin par Vercel (voir vercel.json).
   Chaque commerçant reçoit au plus un résumé par semaine (vérifié dans la base), donc un appel en trop ne fait rien. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Si un secret de tâche planifiée est réglé dans Vercel (CRON_SECRET), seul Vercel peut lancer l'envoi.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const paris = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date());
  if (paris !== "Mon") return NextResponse.json({ ok: true, skipped: "pas lundi" });
  const db = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("weekly_due", { p_key: serverKey() });
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  const rows = (data ?? []) as { endpoint: string; p256dh: string; auth: string; body: string }[];
  for (const r of rows) {
    await sendTo([r], { title: "Votre semaine sur SiteClic", body: r.body, url: "/tableau-de-bord#semaine", tag: "lundi" });
  }
  return NextResponse.json({ ok: true, sent: rows.length });
}
