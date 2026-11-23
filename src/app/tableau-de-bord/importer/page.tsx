import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Importer mon site · SiteClic" };

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  return (
    <main className="grain min-h-dvh px-5 py-6">
      <header className="mx-auto max-w-5xl"><Logo /></header>
      <section className="mt-12 pb-16"><ImportForm /></section>
    </main>
  );
}
