import { NextResponse } from "next/server";
import { z } from "zod";
import { signVoice, voiceEnabled } from "@/lib/voice-server";

/* Phrase d'accueil de l'appel (choisie ici pour pouvoir être lue avec la voix naturelle). Gratuit, sans IA. */

const Body = z.object({ brand: z.string().trim().min(1).max(60), booking: z.boolean().default(true) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalide" }, { status: 400 });
  const { brand, booking } = parsed.data;
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(new Date()));
  const salut = hour >= 18 ? "Bonsoir" : "Bonjour";
  const list = booking
    ? [`${salut}, ${brand}, je vous écoute !`, `${brand}, ${salut.toLowerCase()} ! C'est pour une réservation ?`, `${salut} et bienvenue chez ${brand} ! Qu'est-ce que je peux faire pour vous ?`]
    : [`${salut}, ${brand}, je vous écoute !`, `${brand}, ${salut.toLowerCase()} ! Qu'est-ce que je peux faire pour vous ?`];
  const text = list[Math.floor(Math.random() * list.length)];
  // Petites phrases d'attente, dites si la réponse met plus d'une seconde et demie (comme au téléphone).
  const fillers = ["Je regarde ça.", "Un instant, je vérifie.", "D'accord, je regarde.", "Très bien, une seconde."].map((t) => ({ text: t, sig: signVoice(t) }));
  return NextResponse.json({ text, sig: signVoice(text), voice: voiceEnabled(), fillers });
}
