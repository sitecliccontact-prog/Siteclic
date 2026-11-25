"use client";

import { useEffect, useRef, useState } from "react";
import { useDictation } from "@/lib/hooks/useDictation";
import { speak as sayAloud, stopSpeaking } from "@/lib/hooks/speak";
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

type BookingProps = { slug?: string; brand: string; phone?: string; phoneHref?: string; floor?: FloorTable[] };

/** Ouvre l'appel vocal avec l'assistant (écouté par AssistantWidget). */
export function startAssistantCall() {
  window.dispatchEvent(new Event("siteclic:appel"));
}

function canTalk() {
  const w = window as unknown as Record<string, unknown>;
  return Boolean((w.SpeechRecognition || w.webkitSpeechRecognition) && "speechSynthesis" in window);
}

/** Fenêtre « Réserver une table ». S'ouvre avec tout lien vers #reserver. */
export function BookingDialog({ slug, brand, phone, phoneHref, floor = [] }: BookingProps) {
  const [open, setOpen] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [people, setPeople] = useState(2);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const [time, setTime] = useState("20:00");
  const [table, setTable] = useState("");
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
    if (window.location.hash === "#reserver") setOpen(true);
    return () => root.removeEventListener("click", onClick);
  }, []);

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
      const res = await fetch("/api/reservation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "La demande n'est pas passée. Merci d'appeler directement.");
      setDone(`Merci ${body.name.split(" ")[0]} ! Votre demande${table ? ` pour la table ${table}` : ""} est bien envoyée. ${brand} vous rappelle pour confirmer.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La demande n'est pas passée.");
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
                {phoneHref && <a href={phoneHref} className="s-link">Appeler le {phone}</a>}
                <button type="button" className="s-btn" onClick={() => { setOpen(false); setDone(""); }}>Fermer</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="s-eyebrow">Réservation</p>
                <h2 className="s-display s-modal-title">Réserver une table</h2>
                <button type="button" className="s-call-cta" onClick={() => { if (canTalk()) { setOpen(false); startAssistantCall(); } else setNoVoice(true); }}>
                  <span className="s-call-cta-icon" aria-hidden><PhoneIcon /></span>
                  <span><b>Réserver en parlant à l&apos;IA</b><small>Notre assistant vous répond à voix haute</small></span>
                </button>
                {noVoice && <p className="s-modal-error" role="alert">Votre navigateur ne permet pas de parler à l&apos;assistant. Ouvrez ce site dans Google Chrome, ou remplissez le formulaire ci-dessous.</p>}
                <p className="s-modal-or"><span>ou remplissez le formulaire</span></p>
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
                {error && <p className="s-modal-error" role="alert">{error}</p>}
                <button className="s-btn s-btn-full" disabled={busy}>{busy ? "Envoi…" : "Envoyer la demande"}</button>
                <p className="s-modal-note">Le restaurant vous rappelle pour confirmer.</p>
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
type AssistantProps = { slug?: string; siteId?: string; brand: string; booking: boolean; special: boolean; launcher?: boolean };

export function AssistantWidget({ slug, siteId, brand, booking, special, launcher = true }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const voice = useDictation(setText);
  const usedVoice = useRef(false);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy, open]);

  function say(t: string) {
    sayAloud(t, undefined, "homme");
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

  function listen() {
    if (!callOn.current) return;
    setHeard("");
    setCall("listening");
    earRef.current.start("", "conversation");
  }

  function talk(t: string) {
    setCall("speaking");
    sayAloud(t, () => { if (callOn.current) window.setTimeout(listen, 350); }, "homme");
  }

  async function callAsk(q: string) {
    setCall("thinking");
    const next = [...history.current, { role: "user" as const, text: q }];
    setMsgs(next);
    const reply = await ask(next);
    if (!callOn.current) return;
    setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    talk(reply);
  }

  function startCall() {
    callOn.current = true;
    setSeconds(0);
    setOpen(false);
    const hellos = booking
      ? [`Bonjour, ${brand}, je vous écoute ! C'est pour une réservation ?`, `${brand}, bonsoir… ou bonjour ! Qu'est-ce que je peux faire pour vous ?`, `Bienvenue chez ${brand} ! Vous voulez réserver une table, ou vous avez une question ?`]
      : [`Bonjour, ${brand}, je vous écoute !`, `${brand}, bonjour ! Qu'est-ce que je peux faire pour vous ?`];
    const hour = new Date().getHours();
    const hello = hellos[Math.floor(Math.random() * hellos.length)].replace("bonsoir… ou bonjour", hour >= 18 ? "bonsoir" : "bonjour");
    setMsgs((m) => [...m, { role: "assistant", text: hello }]);
    talk(hello);
  }

  function hangUp(toChat = false) {
    callOn.current = false;
    stopSpeaking();
    ear.cancel();
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

  useEffect(() => () => { callOn.current = false; stopSpeaking(); }, []);

  async function ask(all: Msg[]): Promise<string> {
    // L'IA reçoit la conversation à partir de la première question du visiteur.
    const first = all.findIndex((m) => m.role === "user");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: siteId ? undefined : slug, siteId, messages: all.slice(Math.max(first, all.length - 16)) }),
      });
      const data = await res.json().catch(() => ({}));
      return data.reply || data.error || "Je n'ai pas pu répondre. Réessayez dans un instant.";
    } catch {
      return "Pas de connexion. Réessayez dans un instant.";
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
    const reply = await ask(history);
    setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    if (aloud) say(reply);
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
      {launcher && (
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
          <button type="button" className="s-call-orb" aria-label={call === "listening" ? "J'ai fini de parler" : "Parler"}
            onClick={() => { if (call === "listening") ear.stop(); else if (call === "paused" || call === "speaking") { stopSpeaking(); window.setTimeout(listen, 80); } }}>
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
