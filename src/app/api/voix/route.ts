import { NextResponse } from "next/server";
import { voiceEnabled } from "@/lib/voice-server";

/** La voix naturelle est-elle disponible (clé OpenAI dans Vercel) ? */
export async function GET() {
  return NextResponse.json({ ok: voiceEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
