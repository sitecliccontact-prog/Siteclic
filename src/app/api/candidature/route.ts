import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyOwner } from "@/lib/push";
import { getPublishedSite } from "@/lib/site/published";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

/* Offres d'emploi : candidature envoyée depuis le site (CV facultatif, rangé dans un dossier privé). */

const TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const f = await request.formData().catch(() => null);
  if (!f) return NextResponse.json({ error: "Formulaire illisible." }, { status: 400 });
  const slug = str(f, "slug", 60);
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });
  const site = await getPublishedSite(slug);
  if (!site?.available || !site.content.jobs?.enabled) return NextResponse.json({ error: "Les candidatures sont fermées." }, { status: 404 });
  const name = str(f, "name", 80), phone = str(f, "phone", 30), email = str(f, "email", 120), job = str(f, "job", 80), message = str(f, "message", 1500);
  if (!name || (phone.length < 6 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) return NextResponse.json({ error: "Indiquez votre nom et un téléphone ou un e-mail." }, { status: 400 });

  const db = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  let cv = "";
  const file = f.get("cv");
  if (file instanceof File && file.size > 0) {
    const ext = TYPES[file.type];
    if (!ext) return NextResponse.json({ error: "Le CV doit être un PDF ou une photo." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Le CV est trop lourd (5 Mo maximum)." }, { status: 400 });
    cv = `${slug}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await db.storage.from("cv").upload(cv, file, { contentType: file.type });
    if (error) {
      console.error("CV", error);
      return NextResponse.json({ error: "L'envoi du CV a échoué. Réessayez sans CV ou plus tard." }, { status: 503 });
    }
  }
  const { error } = await db.rpc("apply_job", { p_slug: slug, p_job: job, p_name: name, p_phone: phone, p_email: email, p_message: message, p_cv: cv });
  if (error) {
    if (error.message?.includes("candidature_trop")) return NextResponse.json({ error: "Beaucoup de candidatures aujourd'hui : réessayez demain." }, { status: 429 });
    console.error("Candidature", error);
    return NextResponse.json({ error: "La candidature n'est pas passée. Réessayez plus tard." }, { status: 503 });
  }
  after(() => notifyOwner(slug, { title: "Nouvelle candidature", body: `${name}${job ? ` · ${job}` : ""}${cv ? " · CV joint" : ""}`, url: "/tableau-de-bord/clients", tag: "candidature" }));
  return NextResponse.json({ ok: true });
}
