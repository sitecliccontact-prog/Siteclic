import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { SAMPLE_SITES } from "./samples";
import { parseStoredContent, type SiteContent } from "./schema";

/** Lit la version publiée d'un site (accessible à tous les visiteurs). */
export const getPublishedSite = cache(async (slug: string): Promise<SiteContent | null> => {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  // Exemples de démonstration, uniquement en développement.
  if (slug.startsWith("exemple-") && process.env.NODE_ENV !== "production") return SAMPLE_SITES[slug.slice(8)] ?? null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("get_published_site", { p_slug: slug });
  if (error || !Array.isArray(data) || !data[0]) return null;
  return parseStoredContent(data[0].content);
});
