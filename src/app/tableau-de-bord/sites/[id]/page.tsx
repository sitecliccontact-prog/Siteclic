import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SAMPLE_SITES } from "@/lib/site/samples";
import { parseStoredContent, type SiteContent } from "@/lib/site/schema";
import { publishState } from "@/lib/site/publish-state";
import { createClient } from "@/lib/supabase/server";
import { Editor } from "./Editor";

export const metadata: Metadata = { title: "Modifier mon site · SiteClic" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Exemples de démonstration, uniquement en développement.
  if (id.startsWith("exemple-") && process.env.NODE_ENV !== "production") {
    const sample: SiteContent | undefined = SAMPLE_SITES[id.replace("exemple-", "")];
    if (!sample) notFound();
    return <Editor id={id} initial={sample} publish={publishState(null)} />;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { data } = await supabase.from("sites").select("*").eq("id", id).maybeSingle();
  const content = parseStoredContent(data?.content);
  if (!content) notFound();
  return <Editor id={id} initial={content} publish={publishState(data)} />;
}
