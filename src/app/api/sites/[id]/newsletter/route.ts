import { NextResponse } from "next/server";
import { z } from "zod";
import { ask, explainError } from "@/lib/site/generate";
import { consumeAi } from "@/lib/site/limits";
import { parseStoredContent } from "@/lib/site/schema";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/* Newsletter / SMS : l'IA écrit le message (e-mail + version SMS courte). Compte comme 1 modification IA (≈ 1 centime). */

const Out = z.object({
  subject: z.string().describe("Objet de l'e-mail : court, élégant, sans majuscules partout, 1 emoji maximum"),
  email: z.string().describe("Texte de l'e-mail : 3 à 6 phrases courtes, chaleureuses, avec une invitation claire ; signé du nom du commerce"),
  sms: z.string().describe("Version SMS : 160 caractères maximum, nom du commerce au début, se termine par « STOP au numéro de l'expéditeur pour ne plus recevoir »"),
});

const Body = z.object({ topic: z.string().trim().min(3).max(400) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Veuillez vous reconnecter." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dites en quelques mots ce que vous voulez annoncer." }, { status: 400 });
  const { data: row } = await supabase.from("sites").select("content, slug, status").eq("id", id).maybeSingle();
  const c = parseStoredContent(row?.content);
  if (!c) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  const limit = await consumeAi(supabase, user, "modification");
  if (limit) return NextResponse.json({ error: limit.message, needsSubscription: limit.subscribe }, { status: 429 });
  const url = row?.status === "en_ligne" && row.slug ? `${new URL(request.url).origin}/s/${row.slug}` : "";
  try {
    const out = await ask(
      Out,
      "Tu écris les messages d'un commerce de proximité haut de gamme à ses clients fidèles. Ton sobre, chaleureux, jamais racoleur, aucune exagération, vouvoiement. Uniquement les informations données.",
      `<commerce>${JSON.stringify({ nom: c.brand.name, metier: c.hero.eyebrow, adresse: c.contact.address, telephone: c.contact.phone, site: url })}</commerce>\n<annonce>${parsed.data.topic}</annonce>`,
      "low",
      "eco",
    );
    return NextResponse.json({ ...out, sms: out.sms.slice(0, 300) });
  } catch (err) {
    console.error("Newsletter IA", err);
    return NextResponse.json({ error: explainError(err, "L'IA n'a pas pu écrire le message. Réessayez.") }, { status: 500 });
  }
}
