"use client";

import { useEffect, useRef, useState } from "react";
import { useDictation } from "@/lib/hooks/useDictation";

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

type BookingProps = { slug?: string; brand: string; phone?: string; phoneHref?: string };

/** Fenêtre « Réserver une table ». S'ouvre avec tout lien vers #reserver. */
export function BookingDialog({ slug, brand, phone, phoneHref }: BookingProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [people, setPeople] = useState(2);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

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
      day: String(f.get("day") ?? ""), time: String(f.get("time") ?? ""), message: String(f.get("message") ?? ""),
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
      setDone(`Merci ${body.name.split(" ")[0]} ! Votre demande est bien envoyée. ${brand} vous rappelle pour confirmer.`);
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
                <div className="s-field-row">
                  <label className="s-field"><span>Date</span><input name="day" type="date" min={today} defaultValue={today} required /></label>
                  <label className="s-field"><span>Heure</span><input name="time" type="time" defaultValue="20:00" step={900} required /></label>
                </div>
                <div className="s-field">
                  <span>Personnes</span>
                  <div className="s-stepper">
                    <button type="button" onClick={() => setPeople((n) => Math.max(1, n - 1))} aria-label="Une personne de moins">−</button>
                    <output>{people}</output>
                    <button type="button" onClick={() => setPeople((n) => Math.min(30, n + 1))} aria-label="Une personne de plus">+</button>
                  </div>
                </div>
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
type AssistantProps = { slug?: string; siteId?: string; brand: string; booking: boolean; special: boolean };

export function AssistantWidget({ slug, siteId, brand, booking, special }: AssistantProps) {
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
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "fr-FR";
    const fr = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
    if (fr) u.voice = fr;
    window.speechSynthesis.speak(u);
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
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: siteId ? undefined : slug, siteId, messages: history.slice(-12) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply: string = data.reply || data.error || "Je n'ai pas pu répondre. Réessayez dans un instant.";
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
      if (aloud) say(reply);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Pas de connexion. Réessayez dans un instant." }]);
    } finally {
      setBusy(false);
    }
  }

  const chips = [
    "Quels sont vos horaires ?",
    ...(booking ? ["Je voudrais réserver une table"] : []),
    ...(special ? ["C'est quoi le menu du jour ?"] : []),
    "Où êtes-vous ?",
  ];

  return (
    <>
      <button type="button" className={`s-ai-launch ${siteId ? "is-preview" : ""}`} onClick={() => setOpen(true)} aria-label="Poser une question">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5h16v11H9l-5 4z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
        </svg>
        <span>Une question ?</span>
      </button>
      {open && (
        <div className="s-ai" role="dialog" aria-label={`Assistant de ${brand}`}>
          <header className="s-ai-head">
            <span className="s-ai-dot" aria-hidden />
            <div>
              <p className="s-ai-title">{brand}</p>
              <p className="s-ai-sub">Assistant · répond tout de suite</p>
            </div>
            <button type="button" onClick={() => { setSpeak((v) => !v); window.speechSynthesis?.cancel(); }}
              className={`s-ai-icon ${speak ? "on" : ""}`} aria-pressed={speak} aria-label={speak ? "Ne plus lire les réponses" : "Lire les réponses à voix haute"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 9v6h4l5 4V5L8 9z" />{speak ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 4 6M21 9l-4 6" />}
              </svg>
            </button>
            <button type="button" onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); }} className="s-ai-icon" aria-label="Fermer">×</button>
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
    </>
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

/** Film de présentation fait automatiquement à partir des photos et des textes du site (aucun coût d'IA). */
export function AutoFilm({ photos, lines, brand, sign }: { photos: string[]; lines: string[]; brand: string; sign: string }) {
  // Avec photos : une photo par plan. Sans photo : un plan par phrase, sur fond de couleur.
  const base = photos.length ? photos.slice(0, 5) : lines.slice(0, 4).map(() => "");
  const slides = (base.length ? base : [""]).map((src, i) => ({ src, text: lines[i % Math.max(lines.length, 1)] ?? "" }));
  const all = [...slides, { src: photos[0] ?? "", text: "", end: true }];
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let visible = true;
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 })
      : null;
    if (io && ref.current) io.observe(ref.current);
    const t = window.setInterval(() => { if (visible) setI((n) => (n + 1) % all.length); }, 4200);
    return () => { window.clearInterval(t); io?.disconnect(); };
  }, [all.length]);
  return (
    <div ref={ref} className="s-film-frame s-autofilm" aria-label={`Présentation de ${brand}`} role="img">
      {all.map((s, k) => (
        <div key={k} className={`s-af-slide${k === i ? " on" : ""}${"end" in s ? " end" : ""}${s.src ? "" : " plain"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.src && <img src={s.src} alt="" loading="lazy" referrerPolicy="no-referrer" />}
          <div className="s-af-shade" />
          {"end" in s ? (
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
        {all.map((_, k) => <i key={`${k}-${k === i ? i : "x"}`} className={k < i ? "done" : k === i ? "run" : ""} />)}
      </div>
    </div>
  );
}
