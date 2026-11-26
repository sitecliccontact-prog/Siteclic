import { z } from "zod";
import { checkVoice, VOICES } from "@/lib/voice-server";

/* Lit à voix haute une réponse de l'assistant, avec une voix naturelle et claire (MP3).
   Environ 0,2 centime pour une phrase de 10 secondes. */

export const maxDuration = 30;

const Body = z.object({
  text: z.string().trim().min(1).max(900),
  sig: z.string().max(64),
  voice: z.enum(["homme", "femme"]).default("femme"),
});

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return new Response("voix-indisponible", { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !checkVoice(parsed.data.text, parsed.data.sig)) return new Response("refuse", { status: 403 });
  const { text, voice } = parsed.data;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: VOICES[voice],
      input: text,
      instructions: voice === "femme"
        ? "Parle en français de France, sans accent étranger. Jeune femme à la voix claire, lumineuse et souriante, dynamique et chaleureuse, comme une voix off moderne. Ton enjoué mais naturel, débit fluide, articulation nette."
        : "Parle en français de France, sans accent étranger. Voix claire, naturelle et chaleureuse, comme une personne souriante à l'accueil d'un restaurant au téléphone. Débit normal, articulation nette.",
      response_format: "mp3",
    }),
  });
  if (!res.ok || !res.body) {
    console.error("Synthèse vocale impossible", res.status, await res.text().catch(() => ""));
    return new Response("voix-erreur", { status: 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
