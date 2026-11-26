import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/app/s/[slug]/cadeau/PrintButton";
import { SAMPLE_SITES } from "@/lib/site/samples";
import { parseStoredContent } from "@/lib/site/schema";
import { publicPath } from "@/lib/site/slug";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "QR code de la carte · SiteClic" };

/** Affichette à imprimer : QR code vers la carte et le menu du jour du site en ligne. Gratuit, sans IA. */
export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "";
  let slug: string | null = null;
  let online = false;
  if (id.startsWith("exemple-") && process.env.NODE_ENV !== "production") {
    const sample = SAMPLE_SITES[id.replace("exemple-", "")];
    if (!sample) notFound();
    name = sample.brand.name;
    slug = id;
    online = true;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/connexion");
    const { data } = await supabase.from("sites").select("content, slug, status").eq("id", id).maybeSingle();
    const content = parseStoredContent(data?.content);
    if (!data || !content) notFound();
    name = content.brand.name;
    slug = data.slug;
    online = data.status === "en_ligne";
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "siteclic.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = slug ? `${proto}://${host}${publicPath(slug)}#menu-du-jour` : "";
  const svg = url ? await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b0b0d", light: "#ffffff" } }) : "";

  return (
    <main className="min-h-dvh bg-[#0b0b0d] px-5 py-8 text-[#f5f4f0] print:bg-white print:p-0">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link href={`/tableau-de-bord/sites/${id}`} className="text-sm text-white/60">← Retour</Link>
          {svg && <PrintButton label="Imprimer l'affichette" />}
        </div>
        {!online || !svg ? (
          <p className="rounded-2xl border border-white/10 p-6 text-center text-white/70">Mettez d&apos;abord votre site en ligne : le QR code mènera vers lui.</p>
        ) : (
          <div className="rounded-[28px] bg-white p-8 text-center text-[#0b0b0d] shadow-2xl print:rounded-none print:shadow-none">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-black/50">La carte</p>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight">{name}</p>
            <div className="mx-auto mt-6 w-60 max-w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-6 text-[15px] leading-snug">Scannez pour voir notre carte<br />et le menu du jour</p>
            <p className="mt-4 text-[11px] text-black/40">Avec l&apos;appareil photo de votre téléphone</p>
          </div>
        )}
        <p className="mt-5 text-center text-xs leading-relaxed text-white/50 print:hidden">
          Le QR code ne change jamais : quand vous modifiez votre carte ou votre menu du jour, vos clients voient la nouvelle version.
        </p>
      </div>
    </main>
  );
}
