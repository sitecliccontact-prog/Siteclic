import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedSite } from "@/lib/site/published";
import { LoyaltyCard } from "./LoyaltyCard";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  return { title: site ? `Carte de fidélité · ${site.content.brand.name}` : "Carte de fidélité", robots: { index: false } };
}

/** Carte de fidélité du client (gardée sur son téléphone). */
export default async function LoyaltyPage({ params }: Props) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const l = site?.available ? site.content.loyalty : null;
  if (!site || !l?.enabled) notFound();
  return <LoyaltyCard slug={slug} brand={site.content.brand.name} goal={l.goal} reward={l.reward} />;
}
