import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/* Voix naturelle (synthèse vocale et reconnaissance) via OpenAI.
   Clé OPENAI_API_KEY dans Vercel. Sans clé, l'appli garde les voix du téléphone.

   Pour éviter qu'on utilise notre synthèse vocale pour lire n'importe quoi, seuls les textes
   écrits par notre assistant (signés ici) peuvent être lus. */

export const VOICES = { homme: "ash", femme: "coral" } as const;
export type VoiceName = keyof typeof VOICES;

export function voiceEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function signVoice(text: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "";
  return createHmac("sha256", `siteclic-voix:${key}`).update(text).digest("base64url").slice(0, 32);
}

export function checkVoice(text: string, sig: string) {
  const good = signVoice(text);
  if (!good || good.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}
