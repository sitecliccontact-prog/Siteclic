import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lien reçu par e-mail : confirmation d'inscription ou nouveau mot de passe.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/tableau-de-bord";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) await supabase.rpc("claim_session").then(() => null, () => null);
    if (error && next === "/nouveau-mot-de-passe") {
      return NextResponse.redirect(`${origin}/mot-de-passe-oublie?lien=expire`);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
