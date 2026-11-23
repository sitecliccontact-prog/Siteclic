import type { Metadata } from "next";
import { ResetForm } from "../PasswordForms";

export const metadata: Metadata = { title: "Nouveau mot de passe · SiteClic" };

export default function Page() {
  return (
    <div className="rise">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Nouveau mot de passe</h1>
      <p className="mb-8 mt-2 text-muted">Choisissez-le, puis vous retrouvez directement vos sites.</p>
      <ResetForm />
    </div>
  );
}
