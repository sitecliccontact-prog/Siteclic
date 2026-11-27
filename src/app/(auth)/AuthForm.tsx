"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseReady } from "@/lib/supabase/config";
import { isDisposable } from "@/lib/disposable";

type Mode = "connexion" | "inscription";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const isSignup = mode === "inscription";

  // Lien de parrainage (…/inscription?parrain=CODE) : gardé jusqu'à l'ouverture du tableau de bord.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("parrain");
    if (code && /^[A-Za-z0-9]{6}$/.test(code)) try { localStorage.setItem("sc_parrain", code.toUpperCase()); } catch {}
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (isSignup && !shopName.trim()) return setError("Indiquez le nom de votre commerce.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Cette adresse e-mail ne semble pas valide.");
    if (password.length < (isSignup ? 8 : 1)) return setError(isSignup ? "Le mot de passe doit faire au moins 8 caractères." : "Indiquez votre mot de passe.");
    if (!supabaseReady) {
      setInfo("Les comptes seront activés très bientôt. Merci de votre patience !");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      if (isSignup) {
        if (isDisposable(email)) throw new Error("jetable");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { shop_name: shopName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Presque fini ! Ouvrez l'e-mail que nous venons d'envoyer pour confirmer votre compte (regardez aussi dans les spams). Si vous aviez déjà un compte avec cette adresse, connectez-vous simplement.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      // Cet appareil devient l'un des 2 appareils connectés du compte.
      await supabase.rpc("claim_session").then(() => null, () => null);
      router.push("/tableau-de-bord");
      router.refresh();
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {isSignup && (
        <Field label="Nom de votre commerce" htmlFor="shop">
          <input id="shop" required value={shopName} onChange={(e) => setShopName(e.target.value)}
            placeholder="Ex. Le Petit Bistrot" autoComplete="organization" className={inputCls} />
        </Field>
      )}
      <Field label="Adresse e-mail" htmlFor="email">
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr" autoComplete="email" inputMode="email" className={inputCls} />
      </Field>
      <Field label="Mot de passe" htmlFor="password"
        hint={isSignup ? "8 caractères minimum" : <Link href="/mot-de-passe-oublie" className="text-clic underline-offset-4 hover:underline">Mot de passe oublié ?</Link>}>
        <div className="relative">
          <input id="password" type={show ? "text" : "password"} required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"} className={`${inputCls} pr-24`} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
            className="absolute inset-y-0 right-2 my-auto h-9 rounded-full px-3 text-sm text-clic">
            {show ? "Masquer" : "Afficher"}
          </button>
        </div>
      </Field>

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {info && <p role="status" className="rounded-xl bg-sand px-4 py-3 text-sm text-ink">{info}</p>}

      <button type="submit" disabled={loading}
        className="w-full rounded-full bg-ink py-3.5 font-medium text-cream transition hover:bg-black disabled:opacity-60">
        {loading ? "Un instant…" : isSignup ? "Créer mon compte" : "Me connecter"}
      </button>
      {isSignup && (
        <p className="text-center text-xs leading-relaxed text-muted">
          En créant votre compte, vous acceptez les <Link href="/cgv" className="underline underline-offset-2">conditions de vente</Link> et
          la <Link href="/confidentialite" className="underline underline-offset-2">politique de confidentialité</Link>.
        </p>
      )}

      <p className="pt-2 text-center text-sm text-muted">
        {isSignup ? (
          <>Déjà un compte ? <Link href="/connexion" className="font-medium text-ink underline underline-offset-4">Se connecter</Link></>
        ) : (
          <>Pas encore de compte ? <Link href="/inscription" className="font-medium text-ink underline underline-offset-4">Créer mon site</Link></>
        )}
      </p>
    </form>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-base outline-none transition placeholder:text-muted/60 focus:border-ink focus:ring-4 focus:ring-ink/5";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        {label}
        {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function translate(msg: string) {
  if (msg === "jetable") return "Les adresses e-mail jetables ne sont pas acceptées. Utilisez votre vraie adresse.";
  if (/invalid login/i.test(msg)) return "E-mail ou mot de passe incorrect.";
  if (/not confirmed/i.test(msg)) return "Confirmez d'abord votre adresse : touchez le lien reçu par e-mail (regardez aussi dans les spams).";
  if (/rate limit|too many|seconds/i.test(msg)) return "Trop d'essais d'affilée. Patientez une minute, puis réessayez.";
  if (/fetch|network/i.test(msg)) return "Pas de connexion Internet. Vérifiez votre réseau, puis réessayez.";
  if (/already registered/i.test(msg)) return "Un compte existe déjà avec cet e-mail.";
  if (/password/i.test(msg)) return "Le mot de passe doit faire au moins 8 caractères.";
  if (/email/i.test(msg)) return "Cette adresse e-mail ne semble pas valide.";
  return "Une erreur est survenue. Réessayez dans un instant.";
}
