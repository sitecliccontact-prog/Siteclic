"use client";

import { useEffect, useRef, useState } from "react";

/* Dictée vocale du navigateur (Chrome Android, Chrome/Edge ordinateur, Safari). Rien n'est envoyé à nos serveurs :
   le texte reconnu arrive dans la case, et le commerçant peut le corriger avant d'envoyer. */

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => Recognition) | null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Le micro est bloqué. Autorisez-le pour ce site (icône à gauche de l'adresse), puis réessayez.",
  "service-not-allowed": "Le micro est bloqué. Autorisez-le pour ce site (icône à gauche de l'adresse), puis réessayez.",
  "audio-capture": "Aucun micro trouvé sur cet appareil.",
  network: "La dictée a besoin d'Internet. Vérifiez votre connexion.",
};

/** `base` = texte déjà écrit ; le texte dicté s'ajoute à la suite. */
export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    setSupported(!!getRecognition());
    return () => rec.current?.abort();
  }, []);

  function start(base: string) {
    const Ctor = getRecognition();
    if (!Ctor || listening) return;
    setError("");
    const r = new Ctor();
    r.lang = "fr-FR";
    // Une phrase à la fois : la dictée s'arrête seule après un silence (plus fiable sur Android).
    r.continuous = false;
    r.interimResults = true;
    const prefix = base.trim() ? `${base.trim()} ` : "";
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      said = said.trim();
      if (said) cb.current(prefix + said.charAt(0).toUpperCase() + said.slice(1));
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(ERRORS[e.error] ?? "La dictée n'a pas fonctionné. Réessayez.");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stop() {
    rec.current?.stop();
  }

  return { supported, listening, error, start, stop };
}
