import type { Metadata } from "next";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Connexion · SiteClic" };

export default async function Page({ searchParams }: { searchParams: Promise<{ raison?: string }> }) {
  const { raison } = await searchParams;
  return (
    <div className="rise">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Bon retour parmi nous</h1>
      <p className="mb-8 mt-2 text-muted">Connectez-vous pour retrouver votre site.</p>
      {raison === "autre-appareil" && (
        <p role="status" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Votre compte a été ouvert sur un autre appareil, vous avez donc été déconnecté ici. Un compte s&apos;utilise sur 2 appareils au maximum.
        </p>
      )}
      <AuthForm mode="connexion" />
    </div>
  );
}
