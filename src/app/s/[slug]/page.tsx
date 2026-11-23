import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { getPublishedSite } from "@/lib/site/published";

// La page est gardée en mémoire et rafraîchie dès que le client publie une modification.
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublishedSite(slug);
  if (!content) return { title: "Site introuvable", robots: { index: false } };
  const title = content.seo.title || content.brand.name;
  const description = content.seo.description || content.hero.subtitle;
  const image = content.photos[0];
  return {
    title: { absolute: title },
    description,
    applicationName: content.brand.name,
    appleWebApp: { title: content.brand.name },
    alternates: { canonical: `/s/${slug}` },
    openGraph: { title, description, type: "website", locale: "fr_FR", siteName: content.brand.name, images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PublishedSite({ params }: Props) {
  const { slug } = await params;
  const content = await getPublishedSite(slug);
  if (!content) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: content.brand.name,
    description: content.seo.description || content.hero.subtitle,
    address: content.contact.address || undefined,
    telephone: content.contact.phone || undefined,
    email: content.contact.email || undefined,
    image: content.photos[0] || undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteRenderer content={content} credit />
    </>
  );
}
