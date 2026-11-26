import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseReady, supabaseUrl } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  if (!supabaseReady) return NextResponse.next();
  // Pages d'exemple pour tester l'affichage, uniquement en développement.
  if (process.env.NODE_ENV !== "production" && request.nextUrl.pathname.includes("/exemple-")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Un compte = 2 appareils connectés au maximum : une 3e connexion déconnecte la plus ancienne (anti-partage de compte).
  if (user && !path.startsWith("/connexion") && !path.startsWith("/auth/")) {
    const { data: ok, error } = await supabase.rpc("session_ok");
    if (!error && ok === false) {
      await supabase.auth.signOut({ scope: "local" });
      const out = path.startsWith("/api/")
        ? NextResponse.json({ error: "Votre compte a été ouvert sur un autre appareil. Reconnectez-vous." }, { status: 401 })
        : NextResponse.redirect(new URL("/connexion?raison=autre-appareil", request.url));
      response.cookies.getAll().forEach((c) => out.cookies.set(c));
      return withDevice(request, out);
    }
  }

  if (!user && (path.startsWith("/tableau-de-bord") || path.startsWith("/abonnement"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }
  return withDevice(request, response);
}

/** Petit repère anonyme de l'appareil (pour l'essai gratuit : un seul compte gratuit par appareil). */
function withDevice(request: NextRequest, response: NextResponse) {
  if (!request.cookies.get("sc_dev")) {
    const id = crypto.randomUUID().replace(/-/g, "");
    response.cookies.set("sc_dev", id, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 730, path: "/" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!s/|_next/static|_next/image|sw.js|manifest.webmanifest|.*\\.(?:png|ico|svg|jpg|webp)$).*)"],
};
