"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDictation } from "@/lib/hooks/useDictation";
import { speak, stopSpeaking } from "@/lib/hooks/speak";

/* Bouton « Aide » présent partout dans l'espace commerçant : une IA qui répond à l'écrit et à l'oral. */

type Msg = { role: "user" | "assistant"; text: string };

const PAGES: [RegExp, string][] = [
  [/^\/tableau-de-bord\/sites\//, "Éditeur du site (Modifier)"],
  [/^\/tableau-de-bord\/creer/, "Créer un site (questionnaire)"],
  [/^\/tableau-de-bord\/importer/, "Importer mon site actuel"],
  [/^\/tableau-de-bord\/reservations/, "Tableau des réservations"],
  [/^\/tableau-de-bord/, "Mes sites"],
  [/^\/apercu\//, "Aperçu du site"],
  [/^\/abonnement/, "Tarifs et paiement"],
];

const CHIPS = ["Comment mettre mon site en ligne ?", "Ajouter des photos", "J'ai un message d'erreur", "Changer mes horaires"];

export function HelpWidget() {
  const path = usePathname() ?? "";
  const page = PAGES.find(([r]) => r.test(path))?.[1];
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [aloud, setAloud] = useState(false);
  const usedMic = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const voice = useDictation(setText, (said) => {
    if (usedMic.current && said.trim()) send(said);
  });

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy, open]);
  useEffect(() => () => stopSpeaking(), []);

  if (!page) return null;
  const editor = path.startsWith("/tableau-de-bord/sites/");
  const preview = path.startsWith("/apercu/");

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const speakIt = aloud || usedMic.current;
    usedMic.current = false;
    voice.stop();
    const history = [...msgs, { role: "user" as const, text: question }];
    setMsgs(history);
    setText("");
    setBusy(true);
    const error = Array.from(document.querySelectorAll('[role="alert"]')).map((e) => e.textContent?.trim()).filter(Boolean).join(" · ").slice(0, 400);
    try {
      const res = await fetch("/api/aide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, error, messages: history.slice(-12) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply: string = data.reply || data.error || "Je n'ai pas pu répondre. Réessayez dans un instant.";
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
      if (speakIt) speak(reply);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Pas de connexion Internet. Réessayez dans un instant." }]);
    } finally {
      setBusy(false);
    }
  }

  const launcherPos = editor
    ? "right-3 top-[118px] lg:top-auto lg:bottom-5 lg:right-5"
    : preview
      ? "left-4 bottom-5"
      : "right-4 bottom-5";

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Aide"
          className={`help-in fixed z-[120] flex items-center gap-2 rounded-full border border-white/10 bg-[#141417]/95 text-sm font-medium text-[#f5f4f0] shadow-[0_12px_40px_-10px_rgba(0,0,0,.7)] backdrop-blur transition hover:border-[#ff5b1f]/60 ${editor ? "h-10 px-3 lg:h-auto lg:py-3 lg:pl-3 lg:pr-4" : "py-3 pl-3 pr-4"} ${launcherPos}`}>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ff5b1f] text-[13px] font-bold text-white">?</span>
          <span className={editor ? "hidden lg:inline" : ""}>Aide</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-end sm:justify-end sm:p-5" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="rise flex h-[86dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0f0f12] text-[#f5f4f0] shadow-2xl sm:h-[620px] sm:max-h-[90dvh] sm:w-[400px] sm:rounded-3xl">
            <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <span className="relative grid h-9 w-9 place-items-center rounded-full bg-[#ff5b1f] font-bold text-white">
                ?<span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#0f0f12] bg-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Aide SiteClic</p>
                <p className="text-xs text-white/50">Répond à l&apos;écrit et à l&apos;oral</p>
              </div>
              <button type="button" onClick={() => { setAloud((v) => !v); stopSpeaking(); }} aria-pressed={aloud}
                aria-label={aloud ? "Ne plus lire les réponses" : "Lire les réponses à voix haute"}
                className={`grid h-9 w-9 place-items-center rounded-full border ${aloud ? "border-[#ff5b1f] bg-[#ff5b1f] text-white" : "border-white/15 text-white/70"}`}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 9v6h4l5 4V5L8 9z" />{aloud ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 4 6M21 9l-4 6" />}
                </svg>
              </button>
              <button type="button" onClick={() => { setOpen(false); stopSpeaking(); }} aria-label="Fermer"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-xl text-white/70">×</button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
              <p className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white/[.06] px-4 py-3 text-[15px] leading-relaxed">
                Bonjour ! Je suis l&apos;aide SiteClic. Un souci, une question, un bouton qui ne marche pas ? Dites-moi ce qui se passe, par écrit ou au micro.
              </p>
              {msgs.map((m, i) => (
                <p key={i} className={`w-fit max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.role === "user" ? "ml-auto rounded-br-md bg-[#ff5b1f] text-white" : "rounded-bl-md bg-white/[.06]"}`}>
                  {m.text}
                </p>
              ))}
              {busy && (
                <p className="flex w-fit gap-1.5 rounded-2xl rounded-bl-md bg-white/[.06] px-4 py-4">
                  <span className="dot h-1.5 w-1.5 rounded-full bg-white/50" /><span className="dot h-1.5 w-1.5 rounded-full bg-white/50" /><span className="dot h-1.5 w-1.5 rounded-full bg-white/50" />
                </p>
              )}
              {!msgs.length && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {CHIPS.map((c) => (
                    <button key={c} type="button" onClick={() => send(c)}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:border-[#ff5b1f] hover:text-white">{c}</button>
                  ))}
                </div>
              )}
              <div ref={end} />
            </div>

            {voice.error && <p className="px-4 pb-1 text-xs text-red-400">{voice.error}</p>}
            <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-center gap-2 border-t border-white/10 p-3">
              {voice.supported && (
                <button type="button" aria-label={voice.listening ? "Arrêter" : "Parler"}
                  onClick={() => { if (voice.listening) voice.stop(); else { usedMic.current = true; stopSpeaking(); voice.start("", "attendre"); } }}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition ${voice.listening ? "animate-pulse border-[#ff5b1f] bg-[#ff5b1f] text-white" : "border-white/15 text-white/70"}`}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {voice.listening ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
                  </svg>
                </button>
              )}
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1500}
                placeholder={voice.listening ? "Je vous écoute…" : "Décrivez votre souci…"} aria-label="Votre question"
                className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[.04] px-4 py-3 text-base outline-none focus:border-[#ff5b1f]" />
              <button disabled={busy || !text.trim()} aria-label="Envoyer"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#ff5b1f] text-lg text-white disabled:opacity-30">↑</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
