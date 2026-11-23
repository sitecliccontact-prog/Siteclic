"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, inputCls } from "./AuthForm";

const btn = "w-full rounded-full bg-ink py-3.5 font-medium text-cream transition hover:bg-black disabled:opacity-60";
const errCls = "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300";

/** Demande d'un lien pour choisir un nouveau mot de passe. */
export function ForgotForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? "Ce lien ne fonctionne plus. Demandez-en un nouveau, puis ouvrez-le sur ce même téléphone, dans le même navigateur." : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Cette adresse e-mail ne semble pas valide.");
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/nouveau-mot-de-passe`,
    });
    setLoading(false);
    if (error && /rate|seconds|security/i.test(error.message)) return setError("Un e-mail vient déjà d'être envoyé. Patientez une minute avant de réessayer.");
    if (error) return setError("Une erreur est survenue. Réessayez dans un instant.");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-line bg-card p-6">
        <p className="font-medium">C&apos;est envoyé ✉️</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Si un compte existe avec <span className="text-ink">{email}</span>, vous allez recevoir un e-mail. Touchez le lien qu&apos;il contient pour choisir un nouveau mot de passe. Pensez à regarder dans les spams.
        </p>
        <p className="mt-4 text-sm"><Link href="/connexion" className="font-medium underline underline-offset-4">Retour à la connexion</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Adresse e-mail de votre compte" htmlFor="email">
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr" autoComplete="email" inputMode="email" className={inputCls} />
      </Field>
      {error && <p role="alert" className={errCls}>{error}</p>}
      <button type="submit" disabled={loading} className={btn}>{loading ? "Un instant…" : "Recevoir le lien"}</button>
      <p className="pt-2 text-center text-sm text-muted">
        <Link href="/connexion" className="font-medium text-ink underline underline-offset-4">Retour à la connexion</Link>
      </p>
    </form>
  );
}

/** Choix du nouveau mot de passe (après le lien reçu par e-mail). */
export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return setError("Ce lien ne fonctionne plus. Demandez-en un nouveau depuis « Mot de passe oublié ».");
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      return setError(/different|same/i.test(error.message)
        ? "Choisissez un mot de passe différent de l'ancien."
        : /weak|pwned|leaked/i.test(error.message)
          ? "Ce mot de passe est trop facile à deviner. Choisissez-en un plus long."
          : "Une erreur est survenue. Réessayez dans un instant.");
    }
    router.push("/tableau-de-bord");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Nouveau mot de passe" htmlFor="password"
        hint={<button type="button" onClick={() => setShow((v) => !v)} className="text-clic">{show ? "Masquer" : "Afficher"}</button>}>
        <input id="password" type={show ? "text" : "password"} required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputCls} />
      </Field>
      <p className="text-xs text-muted">8 caractères minimum. Votre téléphone peut le retenir pour vous.</p>
      {error && <p role="alert" className={errCls}>{error}</p>}
      <button type="submit" disabled={loading} className={btn}>{loading ? "Un instant…" : "Enregistrer et me connecter"}</button>
    </form>
  );
}
