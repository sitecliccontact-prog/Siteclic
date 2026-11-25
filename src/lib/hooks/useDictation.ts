"use client";

import { useEffect, useRef, useState } from "react";

/* Dictée vocale du navigateur (Chrome Android, Chrome/Edge ordinateur, Safari). Rien n'est envoyé à nos serveurs.

   Le navigateur coupe le micro après chaque phrase (surtout sur Android). Pour que ce soit agréable :
   - mode "phrase"   : une phrase, puis ça s'arrête (questions rapides) ;
   - mode "attendre" : on relance tout seul tant que la personne n'a rien dit, puis une phrase (conversation) ;
   - mode "long"     : on relance tout seul après chaque phrase jusqu'à ce que la personne touche ■ (longues demandes). */

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type DictationMode = "phrase" | "attendre" | "long";

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

/** Nombre de relances sans rien entendre avant d'abandonner (environ 8 secondes chacune). */
const MAX_SILENT = 4;

function join(a: string, b: string) {
  const s = b.trim();
  if (!s) return a;
  const cap = a.trim() === "" || /[.!?]\s*$/.test(a) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  return a.trim() ? `${a.trim()} ${cap}` : cap;
}

/** `start(base, mode)` : `base` = texte déjà écrit ; le texte dicté s'ajoute à la suite. */
export function useDictation(onText: (text: string) => void, onEnd?: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  const endCb = useRef(onEnd);
  endCb.current = onEnd;

  const active = useRef(false); // la personne veut qu'on écoute
  const mode = useRef<DictationMode>("phrase");
  const acc = useRef(""); // texte des phrases précédentes
  const last = useRef(""); // texte complet actuel
  const silent = useRef(0);

  useEffect(() => {
    setSupported(!!getRecognition());
    return () => {
      active.current = false;
      rec.current?.abort();
    };
  }, []);

  function finish() {
    active.current = false;
    rec.current = null;
    setListening(false);
    endCb.current?.(last.current);
  }

  function session() {
    const Ctor = getRecognition();
    if (!Ctor) return finish();
    const r = new Ctor();
    r.lang = "fr-FR";
    r.continuous = false; // plus fiable sur Android : on relance nous-mêmes
    r.interimResults = true;
    r.maxAlternatives = 1;
    let heard = false;
    const prefix = acc.current;
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      if (!said.trim()) return;
      heard = true;
      last.current = join(prefix, said);
      cb.current(last.current);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(ERRORS[e.error] ?? "La dictée n'a pas fonctionné. Réessayez.");
      if (ERRORS[e.error]) active.current = false; // micro bloqué : inutile de relancer
    };
    r.onend = () => {
      if (rec.current !== r) return;
      acc.current = last.current;
      silent.current = heard ? 0 : silent.current + 1;
      const again =
        active.current &&
        silent.current < MAX_SILENT &&
        (mode.current === "long" || (mode.current === "attendre" && !heard));
      if (again) {
        window.setTimeout(() => (active.current && rec.current === r ? session() : undefined), 120);
      } else {
        finish();
      }
    };
    rec.current = r;
    try {
      r.start();
    } catch {
      finish();
    }
  }

  function start(base: string, how: DictationMode = "phrase") {
    if (!getRecognition() || active.current) return;
    setError("");
    active.current = true;
    mode.current = how;
    acc.current = base.trim();
    last.current = acc.current;
    silent.current = 0;
    setListening(true);
    session();
  }

  /** La personne a fini : on garde ce qui a été dit, puis onEnd est appelé. */
  function stop() {
    if (!active.current && !rec.current) return;
    active.current = false;
    const r = rec.current;
    if (r) r.stop();
    else finish();
  }

  /** Tout arrêter sans rien envoyer. */
  function cancel() {
    active.current = false;
    const r = rec.current;
    rec.current = null;
    r?.abort();
    setListening(false);
  }

  return { supported, listening, error, start, stop, cancel };
}
