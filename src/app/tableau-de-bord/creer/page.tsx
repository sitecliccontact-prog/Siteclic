import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "Créer mon site · SiteClic" };

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const shopName = (user.user_metadata?.shop_name as string) || "";

  return (
    <main className="grain min-h-dvh px-5 py-6">
      <header className="mx-auto max-w-5xl"><Logo /></header>
      <section className="mt-12 pb-16">
        <Wizard defaultName={shopName} />
      </section>
    </main>
  );
}
