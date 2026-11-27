import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseReady, supabaseUrl } from "@/lib/supabase/config";

/** Adresses de SiteClic lui-même (tout le reste = nom de domaine d'un commerçant). */
const OWN_HOST = /(^|\.)(vercel\.app|localhost|127\.0\.0\.1)(:\d+)?$/;
const domainCache = new Map<string, { slug: string | null; at: number }>();

/** Nom de domaine d'un commerçant (ex. belati-bandol.fr) : affiche son site. */
async function customDomain(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host || OWN_HOST.test(host) || host.includes("siteclic")) return null;
  let hit = domainCache.get(host);
  if (!hit || Date.now() - hit.at > 5 * 60 * 1000) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/domain_slug`, {
      method: "POST",
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_host: host.replace(/:\d+$/, "") }),
    }).catch(() => null);
    const slug = res?.ok ? await res.json().catch(() => null) : null;
    hit = { slug: typeof slug === "string" && /^[a-z0-9-]{1,60}$/.test(slug) ? slug : null, at: Date.now() };
    domainCache.set(host, hit);
  }
  if (!hit.slug) return null;
  const path = request.nextUrl.pathname;
  // Seules les pages du site du commerçant sont servies sur son adresse (et les appels du site : réservation, commande…).
  if (path.startsWith("/api/") || path.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(path)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = path === "/" ? `/s/${hit.slug}` : ["/en", "/cadeau", "/fidelite"].includes(path) ? `/s/${hit.slug}${path}` : `/s/${hit.slug}`;
  return NextResponse.rewrite(url);
}

export async function middleware(request: NextRequest) {
  if (!supabaseReady) return NextResponse.next();
  const custom = await customDomain(request);
  if (custom) return custom;
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

  // Déjà connecté : pas besoin de repasser par la connexion ou l'inscription.
  if (user && (path === "/connexion" || path === "/inscription")) {
    const out = NextResponse.redirect(new URL("/tableau-de-bord", request.url));
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
    return out;
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
