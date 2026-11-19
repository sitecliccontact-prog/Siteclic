"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-ink"
    >
      Se déconnecter
    </button>
  );
}
