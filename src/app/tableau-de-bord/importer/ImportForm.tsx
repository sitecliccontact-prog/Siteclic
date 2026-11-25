"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Generating } from "../creer/Wizard";

const STEPS = [
  "Nous ouvrons votre site actuel…",
  "Nous récupérons vos textes et vos photos…",
  "Nous réécrivons vos textes…",
  "Nous choisissons un nouveau design…",
  "Nous mettons la dernière main à votre nouveau site…",
];

export function ImportForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sites/importer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        window.location.href = "/abonnement?retour=/tableau-de-bord/importer";
        return;
      }
      if (!res.ok) throw new Error(data.error || (res.status === 504 ? "L'IA a mis trop de temps à répondre. Réessayez. (code 504)" : "L'import a échoué. Réessayez dans un instant. (code HTTP " + res.status + ")"));
      router.push(`/apercu/${data.id}?nouveau=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'import a échoué.");
      setLoading(false);
    }
  }

  if (loading) return <Generating steps={STEPS} />;

  return (
    <form onSubmit={submit} className="rise mx-auto max-w-xl">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Importer mon site</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Donnez-nous l&apos;adresse de votre site actuel</h1>
      <p className="mt-3 text-muted">
        Nous récupérons vos textes, vos prix, vos horaires et vos photos, puis l&apos;IA en fait une version moderne. Votre site actuel n&apos;est pas modifié.
      </p>
      <label className="mt-8 block">
        <span className="mb-1.5 block text-sm font-medium">Adresse de votre site</span>
        <input
          required
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="www.mon-commerce.fr"
          className="w-full rounded-2xl border border-line bg-card px-4 py-4 text-lg outline-none transition placeholder:text-muted/50 focus:border-ink/60 focus:ring-4 focus:ring-ink/5"
        />
      </label>
      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/tableau-de-bord")} className="rounded-full px-5 py-3 text-sm font-medium text-muted hover:text-ink">
          ← Annuler
        </button>
        <button disabled={url.trim().length < 4}
          className="rounded-full bg-clic px-7 py-3.5 font-medium text-white shadow-[0_10px_30px_-10px_rgba(255,91,31,.6)] transition hover:bg-clic-dark disabled:opacity-30">
          Améliorer mon site
        </button>
      </div>
    </form>
  );
}
