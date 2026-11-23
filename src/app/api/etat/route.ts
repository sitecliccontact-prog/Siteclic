import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Petit diagnostic : dit seulement si les réglages sont présents (jamais leur valeur). */
export function GET() {
  return NextResponse.json({
    environnement: process.env.VERCEL_ENV ?? "local",
    branche: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    cleIA: Boolean(process.env.ANTHROPIC_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  });
}
