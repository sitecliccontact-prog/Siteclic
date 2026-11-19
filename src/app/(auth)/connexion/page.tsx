import type { Metadata } from "next";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Connexion · SiteClic" };

export default function Page() {
  return (
    <div className="rise">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Bon retour parmi nous</h1>
      <p className="mb-8 mt-2 text-muted">Connectez-vous pour retrouver votre site.</p>
      <AuthForm mode="connexion" />
    </div>
  );
}
