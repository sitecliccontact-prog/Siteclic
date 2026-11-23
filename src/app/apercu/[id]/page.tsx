import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { SAMPLE_SITES } from "@/lib/site/samples";
import { parseStoredContent, type SiteContent } from "@/lib/site/schema";
import { publishState } from "@/lib/site/publish-state";
import { createClient } from "@/lib/supabase/server";
import { PreviewShell } from "./PreviewShell";

export const metadata: Metadata = { title: "Aperçu de votre site · SiteClic", robots: { index: false } };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let content: SiteContent | null = null;
  let publish = publishState(null);

  // Exemples de démonstration, uniquement en développement.
  if (id.startsWith("exemple-") && process.env.NODE_ENV !== "production") {
    content = SAMPLE_SITES[id.replace("exemple-", "")] ?? null;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/connexion");
    const { data } = await supabase.from("sites").select("*").eq("id", id).maybeSingle();
    content = parseStoredContent(data?.content);
    publish = publishState(data);
  }
  if (!content) notFound();

  return (
    <PreviewShell id={id} publish={publish}>
      <SiteRenderer content={content} />
    </PreviewShell>
  );
}
