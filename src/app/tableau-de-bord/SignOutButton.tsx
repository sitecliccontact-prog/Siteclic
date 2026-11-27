"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        // Déconnecte seulement ce téléphone (l'autre appareil du compte reste connecté).
        await createClient().auth.signOut({ scope: "local" });
        router.push("/");
        router.refresh();
      }}
      className="rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-ink"
    >
      Se déconnecter
    </button>
  );
}
