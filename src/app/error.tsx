"use client";

import Link from "next/link";
import { useEffect } from "react";

/* Erreur inattendue : un écran calme avec « Réessayer », jamais une page blanche. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="grain flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="rise max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-clic/15 text-2xl text-clic" aria-hidden>!</span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Un petit souci de notre côté.</h1>
        <p className="mt-3 text-muted">Rien n&apos;est perdu : votre site est bien enregistré. Réessayez dans un instant.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={reset} className="rounded-full bg-clic px-6 py-3.5 font-medium text-white">Réessayer</button>
          <Link href="/tableau-de-bord" className="rounded-full border border-line px-6 py-3.5 font-medium hover:border-ink/40">Mes sites</Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-muted/70">Code : {error.digest}</p>}
        <p className="mt-2 text-xs text-muted/70">Le problème continue ? <a href="mailto:siteclic.contact@gmail.com" className="underline">siteclic.contact@gmail.com</a></p>
      </div>
    </main>
  );
}
