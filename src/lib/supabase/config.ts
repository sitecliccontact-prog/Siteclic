export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Vrai quand les clés Supabase ont été ajoutées (fichier .env.local ou Vercel). */
export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
