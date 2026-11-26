"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseReady } from "@/lib/supabase/config";
import { isDisposable } from "@/lib/disposable";

type Mode = "connexion" | "inscription";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const isSignup = mode === "inscription";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
          email,
          password,
          options: {
            data: { shop_name: shopName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Presque fini ! Ouvrez l'e-mail que nous venons d'envoyer pour confirmer votre compte.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
        <input id="password" type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignup ? "new-password" : "current-password"} className={inputCls} />
      </Field>

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {info && <p role="status" className="rounded-xl bg-sand px-4 py-3 text-sm text-ink">{info}</p>}

      <button type="submit" disabled={loading}
        className="w-full rounded-full bg-ink py-3.5 font-medium text-cream transition hover:bg-black disabled:opacity-60">
        {loading ? "Un instant…" : isSignup ? "Créer mon compte" : "Me connecter"}
      </button>

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
  if (/already registered/i.test(msg)) return "Un compte existe déjà avec cet e-mail.";
  if (/password/i.test(msg)) return "Le mot de passe doit faire au moins 8 caractères.";
  if (/email/i.test(msg)) return "Cette adresse e-mail ne semble pas valide.";
  return "Une erreur est survenue. Réessayez dans un instant.";
}
