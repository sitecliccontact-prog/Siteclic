"use client";
import { useEffect } from "react";

/** Indique la langue de la page au navigateur (lecteurs d'écran, traduction automatique). */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const prev = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = prev; };
  }, [lang]);
  return null;
}
