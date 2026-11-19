import type { Metadata } from "next";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Créer mon compte · SiteClic" };

export default function Page() {
  return (
    <div className="rise">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Créons votre site</h1>
      <p className="mb-8 mt-2 text-muted">
        Créez votre compte. Votre site sera prêt en quelques minutes, et l&apos;aperçu est gratuit.
      </p>
      <AuthForm mode="inscription" />
    </div>
  );
}
