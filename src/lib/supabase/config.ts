// Codes publics du projet Supabase « siteclic ».
// Ils sont faits pour être visibles dans l'appli (aucun secret ici).
// On peut les remplacer avec des variables d'environnement (.env.local ou Vercel).
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://zbxkkweqfeuhxhhpmkqz.supabase.co";

export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_-3DsnM_EVUAeZ96SIyjYGg_zPp6PUvk";

/** Vrai quand les codes Supabase sont présents. */
export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
