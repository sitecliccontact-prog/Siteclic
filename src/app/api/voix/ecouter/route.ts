import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Transcrit ce que le visiteur a dit (bien plus fiable que la dictée du téléphone).
   Environ 0,03 centime pour 5 secondes. Limité par site et par visiteur, comme l'assistant. */

export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "voix-indisponible" }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const slug = String(form?.get("slug") ?? "");
  const siteId = String(form?.get("siteId") ?? "");
  if (!(audio instanceof Blob) || audio.size < 800 || audio.size > 4_000_000) return NextResponse.json({ text: "" });

  const supabase = await createClient();
  if (siteId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "connexion" }, { status: 401 });
  } else if (!/^[a-z0-9-]{1,60}$/.test(slug)) {
    return NextResponse.json({ error: "site" }, { status: 400 });
  }
  if (!slug.startsWith("exemple-")) {
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnu";
    const visitor = createHash("sha256").update(`${ip}|${request.headers.get("user-agent") ?? ""}`).digest("hex").slice(0, 32);
    const { data: ok, error } = await supabase.rpc("assistant_hit", { p_slug: `voix:${siteId ? `owner:${siteId}` : slug}`, p_visitor: visitor });
    if (!error && ok === false) return NextResponse.json({ error: "limite" }, { status: 429 });
  }

  const type = audio.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const body = new FormData();
  body.append("file", new File([audio], `voix.${ext}`, { type }));
  body.append("model", "gpt-4o-mini-transcribe");
  body.append("language", "fr");
  body.append("prompt", "Conversation au téléphone avec un restaurant : réservation, date, heure, nombre de personnes, nom, numéro de téléphone.");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body });
  if (!res.ok) {
    console.error("Transcription impossible", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "transcription" }, { status: 502 });
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string };
  return NextResponse.json({ text: (data.text ?? "").trim() });
}
