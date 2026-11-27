"use client";

import { friendlyError } from "@/lib/errors";
import { AddToCalendar, type CalEvent } from "./AddToCalendar";
import { useEffect, useRef, useState } from "react";
import { useDictation } from "@/lib/hooks/useDictation";
import { speak as sayAloud, stopSpeaking } from "@/lib/hooks/speak";
import { listenOnce, naturalVoiceAvailable, releaseMic, speakNatural, stopVoice, transcribe, type Listening } from "@/lib/hooks/voice";
import { floorZones } from "@/lib/site/floor";
import type { FloorTable } from "@/lib/site/schema";

/* Parties interactives des sites clients : animations au défilement et formulaire de réservation. */

/** Apparitions douces des blocs marqués data-r quand ils arrivent à l'écran. */
export function SiteMotion() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest(".site") as HTMLElement | null;
    if (!root || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-r]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    // Ce qui est déjà visible au chargement apparaît tout de suite ; le reste au défilement.
    root.classList.add("motion");
    items.forEach((el) => io.observe(el));

    // Léger mouvement de la grande photo du haut.
    const hero = root.querySelector<HTMLElement>(".s-hero-photo img");
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!hero) return;
        const y = Math.min(hero.getBoundingClientRect().height, Math.max(0, -hero.parentElement!.getBoundingClientRect().top));
        hero.style.translate = `0 ${y * 0.22}px`;
      });
    };
    if (hero) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return <span ref={ref} hidden />;
}

type Guarantee = { mode: "empreinte" | "acompte"; perPerson: number } | null;
type BookingProps = { slug?: string; brand: string; phone?: string; phoneHref?: string; floor?: FloorTable[]; guarantee?: Guarantee };

/** Ouvre l'appel vocal avec l'assistant (écouté par AssistantWidget). */
export function startAssistantCall() {
  window.dispatchEvent(new Event("siteclic:appel"));
}

/* Option « Assistant IA » du commerçant : sans option (ou limite du mois atteinte), on garde le formulaire. */
let aiState: Promise<boolean> | null = null;
function aiAvailable(slug?: string): Promise<boolean> {
  if (!slug) return Promise.resolve(true); // aperçu dans l'éditeur : le commerçant peut tester
  aiState ??= fetch(`/api/assistant/statut?slug=${encodeURIComponent(slug)}`)
    .then((r) => r.json())
    .then((d) => d?.ok === true)
    .catch(() => false);
  return aiState;
}
function markAiOff() {
  aiState = Promise.resolve(false);
  window.dispatchEvent(new Event("siteclic:ia-off"));
}
function useAiOn(slug?: string) {
  const [on, setOn] = useState(!slug);
  useEffect(() => {
    let alive = true;
    void aiAvailable(slug).then((v) => alive && setOn(v));
    const off = () => setOn(false);
    window.addEventListener("siteclic:ia-off", off);
    return () => { alive = false; window.removeEventListener("siteclic:ia-off", off); };
  }, [slug]);
  return on;
}
function newConv() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canTalk() {
  const w = window as unknown as Record<string, unknown>;
  return Boolean((w.SpeechRecognition || w.webkitSpeechRecognition) && "speechSynthesis" in window);
}

/** Fenêtre « Réserver une table ». S'ouvre avec tout lien vers #reserver. */
export function BookingDialog({ slug, brand, phone, phoneHref, floor = [], guarantee: pay = null, fullDay = "" }: BookingProps & { fullDay?: string }) {
  const [open, setOpen] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const aiOn = useAiOn(slug);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [cal, setCal] = useState<CalEvent | null>(null);
  const [error, setError] = useState("");
  const [people, setPeople] = useState(2);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const [time, setTime] = useState("20:00");
  const [table, setTable] = useState("");
  // Restaurant complet ce jour-là : la demande devient une inscription sur la liste d'attente.
  const waiting = Boolean(fullDay) && day === fullDay;
  const guarantee = waiting ? null : pay;
  const [taken, setTaken] = useState<{ time: string; table: string }[]>([]);
  const live = Boolean(slug && !slug.startsWith("exemple-"));

  // Tables déjà réservées ce jour-là (pour les griser sur le plan).
  useEffect(() => {
    if (!open || !floor.length || !live) return;
    let stop = false;
    fetch(`/api/reservation/plan?slug=${encodeURIComponent(slug!)}&day=${day}`)
      .then((r) => r.json())
      .then((d) => { if (!stop) setTaken(Array.isArray(d.taken) ? d.taken : []); })
      .catch(() => {});
    return () => { stop = true; };
  }, [open, day, slug, live, floor.length]);

  useEffect(() => {
    const root = ref.current?.closest(".site");
    if (!root) return;
    const onClick = (e: Event) => {
      const a = (e.target as HTMLElement).closest('a[href="#reserver"]');
      if (!a) return;
      e.preventDefault();
      setOpen(true);
    };
    root.addEventListener("click", onClick);
    const onOpen = () => setOpen(true);
    window.addEventListener("siteclic:reserver", onOpen);
    if (window.location.hash === "#reserver") setOpen(true);
    // Retour de la page de paiement sécurisée (Stripe).
    const back = new URLSearchParams(window.location.search).get("paiement");
    if (back === "ok") setDone(`Merci ! Votre réservation est enregistrée et garantie. ${brand} vous rappelle pour confirmer.`);
    if (back === "annule") setError("La carte n'a pas été enregistrée : votre demande est envoyée, mais elle n'est pas garantie. Vous pouvez aussi appeler le restaurant.");
    if (back) {
      setOpen(true);
      window.history.replaceState(null, "", window.location.pathname + "#reserver");
    }
    return () => { root.removeEventListener("click", onClick); window.removeEventListener("siteclic:reserver", onOpen); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- une seule fois, au chargement

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      slug, people,
      name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""),
      day, time, message: String(f.get("message") ?? ""), table,
    };
    setError("");
    if (!slug || slug.startsWith("exemple-")) {
      setDone(`Ceci est un aperçu : une fois le site en ligne, ${brand} recevra cette demande.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(waiting ? "/api/attente" : "/api/reservation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "La demande n'est pas passée. Merci d'appeler directement.");
      if (typeof data.payUrl === "string" && data.payUrl.startsWith("https://")) {
        window.location.href = data.payUrl; // page de paiement sécurisée Stripe
        return;
      }
      if (!waiting) setCal({ title: `Table chez ${brand} (${people} pers.)`, day, time, minutes: 120, details: `Demande envoyée à ${brand}, en attente de confirmation.${phone ? ` Tél. ${phone}` : ""}` });
      setDone(waiting
        ? `Merci ${body.name.split(" ")[0]} ! Vous êtes sur la liste d'attente. ${brand} vous envoie un SMS dès qu'une table se libère.`
        : `Merci ${body.name.split(" ")[0]} ! Votre demande${table ? ` pour la table ${table}` : ""} est bien envoyée. ${brand} vous rappelle pour confirmer.`);
    } catch (err) {
      setError(friendlyError(err, "La demande n'est pas passée."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref}>
      {open && (
        <div className="s-modal" role="dialog" aria-modal="true" aria-label="Réserver une table" onClick={() => setOpen(false)}>
          <div className="s-modal-panel" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="s-modal-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
            {done ? (
              <div className="s-modal-done">
                <p className="s-eyebrow">Demande envoyée</p>
                <p className="s-display s-modal-title">{done}</p>
                {cal && <AddToCalendar ev={cal} />}
                {phoneHref && <a href={phoneHref} className="s-link">Appeler le {phone}</a>}
                <button type="button" className="s-btn" onClick={() => { setOpen(false); setDone(""); setCal(null); }}>Fermer</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="s-eyebrow">Réservation</p>
                <h2 className="s-display s-modal-title">Réserver une table</h2>
                {aiOn && (<>
                <button type="button" className="s-call-cta" onClick={() => { if (canTalk()) { setOpen(false); startAssistantCall(); } else setNoVoice(true); }}>
                  <span className="s-call-cta-icon" aria-hidden><PhoneIcon /></span>
                  <span><b>Réserver en parlant à l&apos;IA</b><small>Notre assistant vous répond à voix haute</small></span>
                </button>
                {noVoice && <p className="s-modal-error" role="alert">Votre navigateur ne permet pas de parler à l&apos;assistant. Ouvrez ce site dans Google Chrome, ou remplissez le formulaire ci-dessous.</p>}
                <p className="s-modal-or"><span>ou remplissez le formulaire</span></p>
                </>)}
                <div className="s-field-row">
                  <label className="s-field"><span>Date</span><input name="day" type="date" min={today} value={day} onChange={(e) => { setDay(e.target.value); setTable(""); }} required /></label>
                  <label className="s-field"><span>Heure</span><input name="time" type="time" value={time} onChange={(e) => { setTime(e.target.value); setTable(""); }} step={900} required /></label>
                </div>
                <div className="s-field">
                  <span>Personnes</span>
                  <div className="s-stepper">
                    <button type="button" onClick={() => setPeople((n) => Math.max(1, n - 1))} aria-label="Une personne de moins">−</button>
                    <output>{people}</output>
                    <button type="button" onClick={() => setPeople((n) => Math.min(30, n + 1))} aria-label="Une personne de plus">+</button>
                  </div>
                </div>
                {floor.length > 0 && (
                  <FloorPicker tables={floor} people={people} value={table} onChange={setTable}
                    taken={taken.filter((t) => Math.abs(minutes(t.time) - minutes(time)) < 120).map((t) => t.table)} />
                )}
                <label className="s-field"><span>Nom</span><input name="name" autoComplete="name" required maxLength={80} /></label>
                <label className="s-field"><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" required minLength={6} maxLength={30} /></label>
                <label className="s-field"><span>Message <em>(facultatif)</em></span><textarea name="message" rows={2} maxLength={500} placeholder="Terrasse, anniversaire, allergie…" /></label>
                {waiting && (
                  <p className="s-guarantee"><i aria-hidden>⏳</i><span><b>Complet ce jour-là.</b> Laissez votre nom et votre numéro : vous êtes prévenu par SMS dès qu&apos;une table se libère.</span></p>
                )}
                {error && <p className="s-modal-error" role="alert">{error}</p>}
                {guarantee && (
                  <p className="s-guarantee">
                    <span aria-hidden>🔒</span>
                    <span>{guarantee.mode === "empreinte"
                      ? <>Pour garantir la table, une <b>empreinte bancaire</b> est demandée : rien n&apos;est débité. En cas d&apos;absence sans prévenir, {guarantee.perPerson} € par personne peuvent être prélevés.</>
                      : <>Pour garantir la table, un <b>acompte de {guarantee.perPerson * people} €</b> ({guarantee.perPerson} € par personne) est demandé. Il est déduit de l&apos;addition.</>}</span>
                  </p>
                )}
                <button className="s-btn s-btn-full" disabled={busy}>{busy ? "Envoi…" : waiting ? "Rejoindre la liste d'attente" : guarantee ? "Garantir ma table" : "Envoyer la demande"}</button>
                <p className="s-modal-note">{guarantee ? "Paiement sécurisé par Stripe. " : ""}Le restaurant vous rappelle pour confirmer.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Assistant IA pour les visiteurs ---------- */

type Msg = { role: "user" | "assistant"; text: string };
type AssistantProps = { slug?: string; siteId?: string; brand: string; booking: boolean; special: boolean; launcher?: boolean; voiceKind?: "homme" | "femme" };

export function AssistantWidget({ slug, siteId, brand, booking, special, launcher = true, voiceKind = "femme" }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const voice = useDictation(setText);
  const usedVoice = useRef(false);
  const aiOn = useAiOn(siteId ? undefined : slug);
  const conv = useRef("");

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy, open]);

  function say(t: string, sig?: string) {
    void speakNatural(t, sig, voiceKind);
  }


  /* ---------- Appel vocal : l'assistant parle et écoute à tour de rôle, comme au téléphone ---------- */
  const [call, setCall] = useState<null | "listening" | "thinking" | "speaking" | "paused">(null);
  const [heard, setHeard] = useState("");
  const [seconds, setSeconds] = useState(0);
  const callOn = useRef(false);
  const history = useRef<Msg[]>([]);
  history.current = msgs;
  const ear = useDictation(setHeard, (said) => {
    if (!callOn.current) return;
    if (said.trim()) void callAsk(said);
    else setCall("paused"); // plus rien entendu depuis un moment : on attend qu'on touche le cercle
  });

  const earRef = useRef(ear);
  earRef.current = ear;
  // Voix naturelle (serveur) si disponible ; sinon voix et dictée du téléphone.
  const natural = useRef(false);
  const mic = useRef<Listening | null>(null);
  const misses = useRef(0);
  const orb = useRef<HTMLButtonElement>(null);

  function listen() {
    if (!callOn.current) return;
    setHeard("");
    setCall("listening");
    if (!natural.current) {
      earRef.current.start("", "conversation");
      return;
    }
    void listenOnce(async (audio) => {
      mic.current = null;
      if (!callOn.current) return;
      if (!audio) {
        if (++misses.current < 3) return listen();
        return setCall("paused");
      }
      setCall("thinking");
      const said = await transcribe(audio, { slug: siteId ? undefined : slug, siteId, conv: conv.current });
      if (!callOn.current) return;
      if (said === false) return giveUp("Notre assistant n'est pas disponible pour le moment. Je vous ouvre le formulaire de réservation.");
      if (said === null) { natural.current = false; return listen(); } // transcription indisponible : dictée du téléphone
      if (!said.trim()) return listen();
      misses.current = 0;
      setHeard(said);
      void callAsk(said);
    }, (v) => orb.current?.style.setProperty("--lvl", v.toFixed(2))).then((h) => { mic.current = h; });
  }

  // Petites phrases d'attente (« Je regarde ça. ») quand la réponse tarde, comme une vraie personne.
  const fillers = useRef<{ text: string; sig?: string }[]>([]);
  const filling = useRef<Promise<void> | null>(null);

  function talk(t: string, sig?: string) {
    setCall("speaking");
    const next = () => { if (callOn.current) window.setTimeout(listen, 150); };
    if (natural.current) void speakNatural(t, sig, voiceKind, next);
    else sayAloud(t, next, voiceKind);
  }

  async function callAsk(q: string) {
    setCall("thinking");
    const next = [...history.current, { role: "user" as const, text: q }];
    setMsgs(next);
    filling.current = null;
    const timer = window.setTimeout(() => {
      const f = fillers.current[Math.floor(Math.random() * fillers.current.length)];
      if (!f || !callOn.current) return;
      filling.current = new Promise<void>((done) => {
        if (natural.current) void speakNatural(f.text, f.sig, voiceKind, done);
        else sayAloud(f.text, done, voiceKind);
      });
    }, 1600);
    const { reply, sig, fallback } = await ask(next, true);
    window.clearTimeout(timer);
    if (filling.current) await Promise.race([filling.current, new Promise((r) => window.setTimeout(r, 2500))]);
    filling.current = null;
    if (!callOn.current) return;
    if (fallback) return giveUp(reply);
    setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    talk(reply, sig);
  }

  /** Plus d'assistant (option du commerçant terminée ou limite atteinte) : on passe au formulaire. */
  function giveUp(message: string) {
    markAiOff();
    setCall("speaking");
    sayAloud(message, () => {
      hangUp();
      window.dispatchEvent(new Event("siteclic:reserver"));
    }, voiceKind);
  }

  async function startCall() {
    if (!aiOn) return;
    conv.current = newConv();
    callOn.current = true;
    misses.current = 0;
    setSeconds(0);
    setOpen(false);
    setCall("thinking");
    natural.current = await naturalVoiceAvailable();
    let hello = { text: `Bonjour, ${brand}, je vous écoute !`, sig: "" };
    try {
      const r = await fetch("/api/voix/bonjour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand: brand.slice(0, 60), booking }) });
      if (r.ok) {
        const d = await r.json();
        hello = { text: d.text, sig: d.sig };
        fillers.current = Array.isArray(d.fillers) ? d.fillers : [];
      }
    } catch { /* phrase par défaut */ }
    if (!callOn.current) return;
    setMsgs((m) => [...m, { role: "assistant", text: hello.text }]);
    talk(hello.text, hello.sig);
  }

  function hangUp(toChat = false) {
    callOn.current = false;
    stopVoice();
    ear.cancel();
    mic.current?.cancel();
    mic.current = null;
    releaseMic();
    setCall(null);
    if (toChat) setOpen(true);
  }

  useEffect(() => {
    const onCall = () => startCall();
    window.addEventListener("siteclic:appel", onCall);
    return () => window.removeEventListener("siteclic:appel", onCall);
  });

  useEffect(() => {
    if (!call) return;
    const t = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [call === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { callOn.current = false; stopVoice(); releaseMic(); }, []);

  async function ask(all: Msg[], voiceCall = false): Promise<{ reply: string; sig?: string; fallback?: boolean }> {
    if (!conv.current) conv.current = newConv();
    // L'IA reçoit la conversation à partir de la première question du visiteur.
    const first = all.findIndex((m) => m.role === "user");
    try {
      const res = await fetch("/api/assistant", {
        signal: AbortSignal.timeout?.(25000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: siteId ? undefined : slug, siteId, conv: conv.current, voice: voiceCall || undefined, messages: all.slice(Math.max(first, all.length - 16)) }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.fallback) {
        markAiOff();
        if (booking) window.setTimeout(() => window.dispatchEvent(new Event("siteclic:reserver")), 2500);
      }
      return data.reply ? { reply: data.reply, sig: data.sig, fallback: data.fallback === true } : { reply: data.error || "Je n'ai pas pu répondre. Réessayez dans un instant." };
    } catch {
      return { reply: "Pardon, la connexion a coupé. Vous pouvez répéter ?" };
    }
  }

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    voice.stop();
    const history = [...msgs, { role: "user" as const, text: question }];
    setMsgs(history);
    setText("");
    setBusy(true);
    const aloud = speak || usedVoice.current;
    usedVoice.current = false;
    const { reply, sig } = await ask(history);
    setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    if (aloud) say(reply, sig);
    setBusy(false);
  }

  const chips = [
    "Quels sont vos horaires ?",
    ...(booking ? ["Je voudrais réserver une table"] : []),
    ...(special ? ["C'est quoi le menu du jour ?"] : []),
    "Où êtes-vous ?",
  ];

  return (
    <>
      {launcher && aiOn && (
      <button type="button" className={`s-ai-launch ${siteId ? "is-preview" : ""}`} onClick={() => setOpen(true)} aria-label="Poser une question">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5h16v11H9l-5 4z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
        </svg>
        <span>Une question ?</span>
      </button>
      )}
      {open && (
        <div className="s-ai" role="dialog" aria-label={`Assistant de ${brand}`}>
          <header className="s-ai-head">
            <span className="s-ai-dot" aria-hidden />
            <div>
              <p className="s-ai-title">{brand}</p>
              <p className="s-ai-sub">Assistant · répond tout de suite</p>
            </div>
            {voice.supported && (
              <button type="button" onClick={startCall} className="s-ai-icon" aria-label="Appeler l'assistant (parler à voix haute)">
                <PhoneIcon size={17} />
              </button>
            )}
            <button type="button" onClick={() => { setSpeak((v) => !v); stopSpeaking(); }}
              className={`s-ai-icon ${speak ? "on" : ""}`} aria-pressed={speak} aria-label={speak ? "Ne plus lire les réponses" : "Lire les réponses à voix haute"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 9v6h4l5 4V5L8 9z" />{speak ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 4 6M21 9l-4 6" />}
              </svg>
            </button>
            <button type="button" onClick={() => { setOpen(false); stopSpeaking(); }} className="s-ai-icon" aria-label="Fermer">×</button>
          </header>
          <div className="s-ai-body">
            <p className="s-ai-msg bot">Bonjour ! Je suis l&apos;assistant de {brand}. Horaires, carte{booking ? ", réservation" : ""} : posez-moi votre question, par écrit ou au micro.</p>
            {msgs.map((m, i) => <p key={i} className={`s-ai-msg ${m.role === "user" ? "me" : "bot"}`}>{m.text}</p>)}
            {busy && <p className="s-ai-msg bot s-ai-typing"><i /><i /><i /></p>}
            {!msgs.length && (
              <div className="s-ai-chips">
                {chips.map((c) => <button key={c} type="button" onClick={() => send(c)}>{c}</button>)}
              </div>
            )}
            <div ref={end} />
          </div>
          {voice.error && <p className="s-ai-error">{voice.error}</p>}
          <form className="s-ai-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            {voice.supported && (
              <button type="button" className={`s-ai-mic ${voice.listening ? "on" : ""}`}
                onClick={() => { if (voice.listening) voice.stop(); else { usedVoice.current = true; voice.start(text); } }}
                aria-label={voice.listening ? "Arrêter" : "Parler"}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {voice.listening ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
                </svg>
              </button>
            )}
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
              placeholder={voice.listening ? "Je vous écoute…" : "Votre question…"} aria-label="Votre question" />
            <button className="s-ai-send" disabled={busy || !text.trim()} aria-label="Envoyer">↑</button>
          </form>
        </div>
      )}
      {call && (
        <div className={`s-call is-${call}`} role="dialog" aria-label={`Appel avec l'assistant de ${brand}`}>
          <div className="s-call-top">
            <p className="s-call-brand">{brand}</p>
            <p className="s-call-time">Assistant · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>
          </div>
          <button ref={orb} type="button" className="s-call-orb" aria-label={call === "listening" ? "J'ai fini de parler" : "Parler"}
            onClick={() => {
              if (call === "listening") { if (natural.current) mic.current?.finish(); else ear.stop(); }
              else if (call === "paused" || call === "speaking") { stopVoice(); misses.current = 0; window.setTimeout(listen, 80); }
            }}>
            <i /><i /><i />
            <span><PhoneIcon size={34} /></span>
          </button>
          <p className="s-call-state">
            {call === "listening" ? "Je vous écoute…" : call === "thinking" ? "Un instant…" : call === "speaking" ? "L'assistant vous répond" : "Touchez le cercle pour parler"}
          </p>
          <p className="s-call-line">
            {call === "listening" ? heard || "Parlez normalement, comme au téléphone." : [...msgs].reverse().find((m) => m.role === (call === "thinking" ? "user" : "assistant"))?.text}
          </p>
          {ear.error && <p className="s-call-error">{ear.error}</p>}
          <div className="s-call-actions">
            <button type="button" className="s-call-small" onClick={() => hangUp(true)} aria-label="Continuer par écrit">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></svg>
              <span>Écrire</span>
            </button>
            <button type="button" className="s-call-end" onClick={() => hangUp()} aria-label="Raccrocher">
              <PhoneIcon size={26} />
            </button>
            <span className="s-call-small s-call-ghost" aria-hidden />
          </div>
        </div>
      )}
    </>
  );
}

function PhoneIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

/** Vidéo de présentation du commerçant : lecture automatique sans le son, en boucle, bouton pour mettre le son. */
export function SiteVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  // Les téléphones ne lancent une vidéo toute seule que si elle est muette : on s'en assure.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    void v.play().catch(() => {});
  }, [src]);
  return (
    <div className="s-film-frame">
      <video ref={ref} src={src} autoPlay muted={muted} loop playsInline preload="metadata" />
      <button type="button" className="s-film-sound" aria-label={muted ? "Mettre le son" : "Couper le son"}
        onClick={() => { const v = ref.current; setMuted(!muted); if (v) { v.muted = !muted; void v.play().catch(() => {}); } }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5 6 9H3v6h3l5 4z" />
          {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
        </svg>
      </button>
    </div>
  );
}

/** Film de présentation monté automatiquement : les petits clips vidéo du commerçant (et/ou ses photos),
    avec ses textes, des fondus et une fin à son nom. Tout se fait dans le navigateur : aucun coût d'IA. */
export function AutoFilm({ photos, clips = [], lines, brand, sign }: { photos: string[]; clips?: string[]; lines: string[]; brand: string; sign: string }) {
  type Slide = { src: string; clip?: boolean; text: string; end?: boolean };
  const media: { src: string; clip?: boolean }[] = clips.length
    ? [...clips.slice(0, 5).map((src) => ({ src, clip: true })), ...photos.slice(0, Math.max(0, 3 - clips.length)).map((src) => ({ src }))]
    : photos.length ? photos.slice(0, 5).map((src) => ({ src })) : lines.slice(0, 4).map(() => ({ src: "" }));
  const slides: Slide[] = (media.length ? media : [{ src: "" }]).map((m, k) => ({ ...m, text: lines[k % Math.max(lines.length, 1)] ?? "" }));
  const all: Slide[] = [...slides, { src: photos[0] ?? "", text: "", end: true }];
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const dur = all[i]?.clip ? 5200 : 4200;

  useEffect(() => {
    if (!("IntersectionObserver" in window) || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // Le plan en cours joue son clip depuis le début ; les autres sont en pause.
    vids.current.forEach((v, k) => {
      if (!v) return;
      if (k === i) { v.currentTime = 0; void v.play().catch(() => {}); } else v.pause();
    });
    const t = window.setTimeout(function next() {
      if (visible.current) setI((n) => (n + 1) % all.length);
      else window.setTimeout(next, 800);
    }, dur);
    return () => window.clearTimeout(t);
  }, [i, dur, all.length]);

  return (
    <div ref={ref} className="s-film-frame s-autofilm" aria-label={`Présentation de ${brand}`} role="img">
      {all.map((s, k) => (
        <div key={k} className={`s-af-slide${k === i ? " on" : ""}${s.end ? " end" : ""}${s.src ? "" : " plain"}${s.clip ? " is-clip" : ""}`}>
          {s.clip ? (
            <video ref={(el) => { vids.current[k] = el; }} src={s.src} muted playsInline preload={k < 2 ? "auto" : "metadata"} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            s.src && <img src={s.src} alt="" loading="lazy" referrerPolicy="no-referrer" />
          )}
          <div className="s-af-shade" />
          {s.end ? (
            <div className="s-af-end">
              <p className="s-display">{brand}</p>
              {sign && <span>{sign}</span>}
            </div>
          ) : (
            s.text && <p className="s-af-cap s-display">{s.text}</p>
          )}
        </div>
      ))}
      <div className="s-af-bars" aria-hidden>
        {all.map((s, k) => (
          <i key={`${k}-${k === i ? i : "x"}`} className={k < i ? "done" : k === i ? "run" : ""}
            style={{ "--af-d": `${s.clip ? 5200 : 4200}ms` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Plan de salle : le visiteur touche la table qu'il veut, comme pour choisir sa place au cinéma. */
function FloorPicker({ tables, people, taken, value, onChange }: { tables: FloorTable[]; people: number; taken: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div className="s-field">
      <span>Votre table <em>(facultatif)</em></span>
      <div className="s-floor" role="radiogroup" aria-label="Plan de salle">
        {floorZones(tables).map((z) => (
          <span key={z.name} aria-hidden className={`s-floor-zone${z.outside ? " is-out" : ""}`}
            style={{ "--zx": `${Math.max(2, z.x - 8)}%`, "--zy": `${Math.max(1, z.y - 19)}%` } as React.CSSProperties}>{z.name}</span>
        ))}
        {tables.map((t) => {
          const busy = taken.includes(t.label);
          const small = t.seats < people;
          const on = value === t.label;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} disabled={busy || small}
              aria-label={`Table ${t.label}, ${t.seats} places${t.zone ? `, ${t.zone}` : ""}${busy ? ", déjà réservée" : small ? ", trop petite" : ""}`}
              onClick={() => onChange(on ? "" : t.label)}
              className={`s-tbl is-${t.shape}${on ? " on" : ""}${busy ? " busy" : ""}${small && !busy ? " small" : ""}`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}>
              <b>{t.label}</b><small>{t.seats} pl.</small>
              {Array.from({ length: Math.min(t.seats, 8) }, (_, k) => (
                <i key={k} style={{ "--a": `${(360 / Math.min(t.seats, 8)) * k}deg` } as React.CSSProperties} />
              ))}
            </button>
          );
        })}
      </div>
      <div className="s-floor-legend">
        <span><i className="l-free" />Libre</span><span><i className="l-on" />Votre choix</span><span><i className="l-busy" />Réservée</span>
      </div>
      <p className="s-floor-pick">
        {value ? <>Table <b>{value}</b>{tables.find((t) => t.label === value)?.zone ? ` · ${tables.find((t) => t.label === value)?.zone}` : ""} <button type="button" onClick={() => onChange("")}>Changer</button></> : "Touchez une table sur le plan, ou laissez-nous choisir."}
      </p>
    </div>
  );
}
