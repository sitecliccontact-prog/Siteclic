import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { ownerIsSubscribed } from "@/lib/billing/stripe";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { SAMPLE_SITES } from "./samples";
import { parseStoredContent, type SiteContent } from "./schema";

export type Published = { content: SiteContent; available: boolean };

/** Lit la version publiée d'un site (accessible à tous les visiteurs). */
export const getPublishedSite = cache(async (slug: string): Promise<Published | null> => {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  // Exemples de démonstration, uniquement en développement.
  if (slug.startsWith("exemple-") && process.env.NODE_ENV !== "production") {
    const sample = SAMPLE_SITES[slug.slice(8)];
    return sample ? { content: sample, available: true } : null;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("get_published_site", { p_slug: slug });
  if (error || !Array.isArray(data) || !data[0]) return null;
  const content = parseStoredContent(data[0].content);
  if (!content) return null;
  // Si l'abonnement du commerçant est terminé, le site n'est plus affiché.
  let available = true;
  try {
    available = await ownerIsSubscribed(data[0].billing_customer, data[0].user_id);
  } catch (err) {
    console.error("Vérification de l'abonnement impossible", err); // en cas de panne Stripe, on laisse le site visible
  }
  return { content, available };
});
