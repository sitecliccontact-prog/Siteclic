import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HtmlLang } from "@/components/site/HtmlLang";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { getPublishedSite } from "@/lib/site/published";
import { englishContent } from "@/lib/site/translate";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const en = site?.available ? englishContent(site.content) : null;
  if (!en) return { title: "Not found", robots: { index: false } };
  return {
    title: { absolute: en.seo.title || en.brand.name },
    description: en.seo.description || en.hero.subtitle,
    alternates: { canonical: `/s/${slug}/en`, languages: { fr: `/s/${slug}` } },
    openGraph: { title: en.seo.title || en.brand.name, description: en.seo.description, type: "website", locale: "en_GB", siteName: en.brand.name, images: en.photos[0] ? [en.photos[0]] : undefined },
  };
}

export default async function EnglishSite({ params }: Props) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const en = site?.available ? englishContent(site.content) : null;
  if (!en) notFound();
  return <><HtmlLang lang="en" /><SiteRenderer content={en} credit slug={slug} lang="en" /></>;
}
