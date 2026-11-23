import type { Metadata } from "next";
import { ForgotForm } from "../PasswordForms";

export const metadata: Metadata = { title: "Mot de passe oublié · SiteClic" };

export default async function Page({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const { lien } = await searchParams;
  return (
    <div className="rise">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Mot de passe oublié ?</h1>
      <p className="mb-8 mt-2 text-muted">Ça arrive. Indiquez votre e-mail, nous vous envoyons un lien pour en choisir un nouveau.</p>
      <ForgotForm expired={lien === "expire"} />
    </div>
  );
}
