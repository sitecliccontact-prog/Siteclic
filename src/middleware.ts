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

  if (!user && (request.nextUrl.pathname.startsWith("/tableau-de-bord") || request.nextUrl.pathname.startsWith("/abonnement"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!s/|_next/static|_next/image|sw.js|manifest.webmanifest|.*\\.(?:png|ico|svg|jpg|webp)$).*)"],
};
