import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { billingEnabled } from "@/lib/billing/stripe";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { isTeam } from "@/lib/team";

/* Réglages du propriétaire (page « Mes statistiques ») : essai gratuit, budget IA gratuit, mise en ligne gratuite. */

export type AppSettings = { free_trial: boolean; free_budget_cents: number; free_publish: boolean; max_per_ip_day: number };
export const DEFAULT_SETTINGS: AppSettings = { free_trial: true, free_budget_cents: 300, free_publish: false, max_per_ip_day: 3 };

export const getAppSettings = cache(async (): Promise<AppSettings> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data } = await supabase.rpc("app_settings_get");
    return Array.isArray(data) && data[0] ? (data[0] as AppSettings) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** Tant que le paiement Stripe n'est pas ouvert : seuls les comptes du propriétaire (ou tous, s'il l'autorise) peuvent mettre en ligne. */
export async function freePublishAllowed(user: User | null) {
  if (billingEnabled() || isTeam(user)) return true;
  return (await getAppSettings()).free_publish;
}
