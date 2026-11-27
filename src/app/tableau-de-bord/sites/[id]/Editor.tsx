"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColorStudio } from "./ColorStudio";
import { THEMES } from "@/components/site/themes";
import { useEffect, useRef, useState } from "react";
import { PublishButton, type PublishState } from "@/components/PublishButton";
import { DailyPanel } from "./DailyPanel";
import { celebrate } from "@/components/Celebration";
import { friendlyError } from "@/lib/errors";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { useDictation } from "@/lib/hooks/useDictation";
import { speak, stopSpeaking } from "@/lib/hooks/speak";
import { MAX_PHOTOS, uploadPhoto } from "@/lib/site/photos";
import type { SiteContent, ThemeName } from "@/lib/site/schema";

type Tab = "ia" | "main" | "apercu";
type Msg = { from: "moi" | "ia"; text: string; subscribe?: boolean; image?: string };
type SaveState = "ok" | "saving" | "error";

const SUGGESTIONS = [
  "On ferme à 19h le samedi",
  "Ajoute un plat du jour à 14 €",
  "Rends les textes plus courts",
  "Passe à un style plus moderne",
];

const THEME_LABELS: { id: ThemeName; label: string; colors: [string, string] }[] = [
  { id: "bistrot", label: "Bistrot", colors: ["#13261f", "#c9a45c"] },
  { id: "atelier", label: "Atelier", colors: ["#ffffff", "#e63312"] },
  { id: "terracotta", label: "Terracotta", colors: ["#f5ece0", "#bf5b2c"] },
  { id: "minuit", label: "Minuit", colors: ["#0d1322", "#c8a96a"] },
  { id: "jardin", label: "Jardin", colors: ["#eef0e7", "#5f7f63"] },
  { id: "riviera", label: "Méditerranée", colors: ["#f7f4ee", "#1d5f8c"] },
  { id: "galerie", label: "Minimaliste", colors: ["#fafaf7", "#121212"] },
  { id: "retro", label: "Rétro", colors: ["#f3e9d7", "#8c1c1f"] },
];

export function Editor({ id, initial, publish }: { id: string; initial: SiteContent; publish: PublishState }) {
  const [content, setContent] = useState<SiteContent>(initial);
  const [history, setHistory] = useState<SiteContent[]>([]);
  const [tab, setTab] = useState<Tab>("ia");
  const [save, setSave] = useState<SaveState>("ok");
  const [changed, setChanged] = useState(publish.hasChanges);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = useRef<SiteContent | null>(null);

  async function saveNow(next: SiteContent) {
    const res = await fetch(`/api/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: next }),
    }).catch(() => null);
    if (res?.ok && unsaved.current === next) unsaved.current = null;
    if (!res?.ok) unsaved.current ??= next;
    setSave(res?.ok ? "ok" : "error");
  }

  // Fermer la page pendant un enregistrement : le navigateur prévient d'abord.
  useEffect(() => {
    if (save === "ok") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // Enregistrement automatique, une seconde après la dernière modification à la main.
  function queueSave(next: SiteContent) {
    if (pending.current) clearTimeout(pending.current);
    setSave("saving");
    setChanged(true);
    unsaved.current = next;
    pending.current = setTimeout(() => saveNow(next), 1000);
  }

  // Avant de publier : on enregistre tout de suite la dernière frappe.
  async function flush() {
    if (pending.current) clearTimeout(pending.current);
    if (unsaved.current) await saveNow(unsaved.current);
  }

  function edit(fn: (draft: SiteContent) => void) {
    const next = structuredClone(content);
    fn(next);
    setContent(next);
    queueSave(next);
  }

  // Garde une version pour « Annuler » (une seule par série de frappes rapprochées).
  const lastSnapshot = useRef(0);
  function remember(force = false) {
    const now = Date.now();
    if (!force && now - lastSnapshot.current < 3000) return;
    lastSnapshot.current = now;
    setHistory((h) => [...h.slice(-19), content]);
  }

  // Ajoute des photos envoyées par le client et les enregistre tout de suite.
  async function addPhotos(urls: string[], asCover = false) {
    remember(true);
    const next = structuredClone(content);
    next.photos = (asCover ? [...urls, ...next.photos] : [...next.photos, ...urls]).slice(0, MAX_PHOTOS);
    setContent(next);
    queueSave(next);
    await flush();
  }

  function undo() {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setContent(prev);
    queueSave(prev);
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* Barre du haut */}
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/tableau-de-bord" className="shrink-0 whitespace-nowrap text-sm text-muted hover:text-ink">← Mes sites</Link>
        <p className="min-w-0 flex-1 truncate text-center font-display font-bold">{content.brand.name}</p>
        {save === "error" ? (
          <button onClick={() => unsaved.current && saveNow(unsaved.current)} role="alert"
            className="shrink-0 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300">
            Non enregistré · Réessayer
          </button>
        ) : (
          <span className="shrink-0 text-xs text-muted" aria-live="polite">
            <span className={`inline-block h-2 w-2 rounded-full sm:hidden ${save === "saving" ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`}
              title={save === "saving" ? "Enregistrement…" : "Enregistré"} />
            <span className="hidden sm:inline">{save === "saving" ? "Enregistrement…" : "Enregistré ✓"}</span>
          </span>
        )}
        <button onClick={undo} disabled={!history.length}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-medium disabled:opacity-30">
          Annuler
        </button>
        <Link href={`/apercu/${id}`} className="hidden rounded-full border border-line px-3 py-1.5 text-xs font-medium sm:inline-block">Aperçu</Link>
        <PublishButton id={id} initial={{ ...publish, hasChanges: changed }}
          beforePublish={flush} onPublished={() => setChanged(false)} compact />
      </header>

      {/* Onglets (téléphone) */}
      <nav className="grid grid-cols-3 border-b border-line text-sm lg:hidden">
        {([["ia", "Écrire à l'IA"], ["main", "Modifier moi-même"], ["apercu", "Voir"]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap px-1 py-3 text-[13px] font-medium transition sm:text-sm ${tab === t ? "border-b-2 border-clic text-ink" : "text-muted"}`}>
            {l}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1">
        {/* Panneau d'édition */}
        <aside className={`${tab === "apercu" ? "hidden" : "flex"} w-full flex-col border-line lg:flex lg:w-[440px] lg:shrink-0 lg:border-r`}>
          <div className="hidden border-b border-line lg:grid lg:grid-cols-2">
            {([["ia", "Écrire à l'IA"], ["main", "Modifier moi-même"]] as [Tab, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`py-3 text-sm font-medium ${tab === t || (t === "ia" && tab === "apercu") ? "border-b-2 border-clic" : "text-muted"}`}>
                {l}
              </button>
            ))}
          </div>
          {/* Les deux panneaux restent ouverts : la discussion avec l'IA n'est pas perdue en changeant d'onglet. */}
          <div className={`${tab === "main" ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}>
            <ManualPanel id={id} content={content} edit={(fn) => { remember(); edit(fn); }} addPhotos={addPhotos}
              daily={<DailyPanel id={id} content={content} beforeSave={flush}
                onSaved={(c) => setContent((prev) => ({ ...prev, special: c.special, booking: c.booking }))} />} />
          </div>
          <div className={`${tab === "main" ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}>
            <AiPanel id={id} photoCount={content.photos.length} beforeSend={flush} addPhotos={addPhotos}
              onResult={(c) => { remember(true); setContent(c); setChanged(true); }} />
          </div>
        </aside>

        {/* Aperçu en direct */}
        <section className={`${tab === "apercu" ? "block" : "hidden"} min-w-0 flex-1 overflow-y-auto bg-sand lg:block`}>
          <div className="lg:p-6">
            <div className="overflow-hidden lg:rounded-2xl lg:border lg:border-line lg:shadow-2xl">
              <SiteRenderer content={content} siteId={id} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- Écrire à l'IA ---------- */

type AiProps = {
  id: string;
  photoCount: number;
  onResult: (c: SiteContent) => void;
  beforeSend: () => Promise<void>;
  addPhotos: (urls: string[], asCover?: boolean) => Promise<void>;
};

function AiPanel({ id, photoCount, onResult, beforeSend, addPhotos }: AiProps) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "ia", text: "Bonjour ! Dites-moi ce que vous voulez changer sur votre site, comme dans un message. Par exemple : « On ferme à 19h le samedi ». Vous pouvez aussi parler : touchez le micro." },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  // Mode conversation : on parle, l'IA modifie le site et répond à voix haute, puis réécoute.
  const [talk, setTalk] = useState<"off" | "listening" | "thinking" | "speaking">("off");
  const talkOn = useRef(false);
  const voice = useDictation(setText, (said) => {
    if (!talkOn.current) return;
    if (said.trim()) {
      send(said);
    } else {
      // Plus rien entendu depuis un moment : on met en pause, sans rien casser.
      talkOn.current = false;
      setTalk("off");
      setMsgs((m) => [...m, { from: "ia", text: "Je ne vous entends plus. Touchez « Parler à l'IA » pour reprendre." }]);
    }
  });
  const box = useRef<HTMLTextAreaElement>(null);
  // La case grandit avec le texte (jusqu'à environ 40 % de l'écran), pour écrire ou dicter de longues demandes.
  useEffect(() => {
    const t = box.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, Math.round(window.innerHeight * 0.4))}px`;
  }, [text]);
  const fileInput = useRef<HTMLInputElement>(null);

  function startTalk() {
    talkOn.current = true;
    setTalk("listening");
    stopSpeaking();
    setText("");
    voice.start("", "conversation");
  }
  function stopTalk() {
    talkOn.current = false;
    setTalk("off");
    voice.cancel();
    stopSpeaking();
  }
  function answer(reply: string) {
    if (!talkOn.current) return;
    setTalk("speaking");
    speak(reply, () => {
      if (talkOn.current) startTalk();
    });
  }
  useEffect(() => () => stopSpeaking(), []);

  async function attach(files: FileList | null) {
    if (!files?.length || busy) return;
    if (photoCount >= MAX_PHOTOS) {
      setMsgs((m) => [...m, { from: "ia", text: `Votre site a déjà ${MAX_PHOTOS} photos. Retirez-en une dans « Modifier moi-même » pour en ajouter une autre.` }]);
      return;
    }
    const file = files[0];
    setBusy(true);
    try {
      const url = await uploadPhoto(file, id);
      await addPhotos([url]);
      setLastPhoto(url);
      setMsgs((m) => [...m,
        { from: "moi", text: "", image: url },
        { from: "ia", text: "Photo ajoutée à votre site. Où voulez-vous la mettre ? Par exemple : « Mets-la en grand en haut du site »." },
      ]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "ia", text: friendlyError(e, "L'envoi de la photo a échoué.") }]);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function send(instruction: string) {
    if (!instruction.trim() || busy) return;
    if (!talkOn.current) voice.cancel();
    if (talkOn.current) {
      setTalk("thinking");
      speak("D'accord, je m'en occupe."); // réponse immédiate pendant que l'IA travaille
    }
    setMsgs((m) => [...m, { from: "moi", text: instruction }]);
    setText("");
    setBusy(true);
    try {
      await beforeSend();
      const full = lastPhoto ? `${instruction}\n\n(Si je parle de « cette photo » ou « la photo », il s'agit de la dernière photo ajoutée : ${lastPhoto})` : instruction;
      const res = await fetch(`/api/sites/${id}/ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: full }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        answer("Les modifications par l'IA sont incluses avec votre site.");
        setMsgs((m) => [...m, { from: "ia", subscribe: true, text: "Les modifications par l'IA sont incluses avec votre site (20 €, 50 modifications). Vous pouvez aussi modifier vos textes vous-même, gratuitement." }]);
        return;
      }
      if (!res.ok && data.needsSubscription) {
        answer(data.error);
        setMsgs((m) => [...m, { from: "ia", subscribe: true, text: data.error }]);
        return;
      }
      if (!res.ok) throw new Error(data.error || "La modification a échoué.");
      onResult(data.content);
      setMsgs((m) => [...m, { from: "ia", text: data.reply }]);
      celebrate("Site mis à jour");
      answer(data.reply);
    } catch (e) {
      const t = friendlyError(e, "La modification a échoué.");
      setMsgs((m) => [...m, { from: "ia", text: t }]);
      answer(t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i}
            className={`w-fit max-w-[88%] rounded-2xl text-[15px] leading-relaxed ${m.image ? "ml-auto overflow-hidden p-1" : `px-4 py-3 ${m.from === "moi" ? "ml-auto rounded-br-md bg-clic text-white" : "rounded-bl-md bg-card"}`}`}>
            {m.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt="" className="max-h-56 rounded-xl object-cover" />
            )}
            {m.text}
            {m.subscribe && (
              <Link href={`/abonnement?retour=/tableau-de-bord/sites/${id}`}
                className="mt-3 block rounded-full bg-clic px-4 py-2 text-center text-sm font-medium text-white">
                Voir les tarifs
              </Link>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-card px-4 py-4">
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        {voice.supported && (talk === "off" ? (
          <button type="button" onClick={startTalk} disabled={busy}
            className="mb-3 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-clic/40 bg-clic/10 py-3 text-[15px] font-medium text-ink transition hover:bg-clic/15 disabled:opacity-40">
            <Waves /> <span className="whitespace-nowrap">Parler à l&apos;IA</span>
            <span className="hidden text-xs font-normal text-muted sm:inline">· elle vous répond à voix haute</span>
          </button>
        ) : (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-clic px-4 py-3 text-white">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 ${talk === "listening" ? "animate-pulse" : ""}`}><Waves /></span>
            <span className="flex-1 text-[15px] font-medium">
              {talk === "listening" ? (text || "Je vous écoute…") : talk === "thinking" ? "Je modifie votre site…" : "Je vous réponds…"}
            </span>
            <button type="button" onClick={stopTalk} className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium">Arrêter</button>
          </div>
        ))}
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-ink/40 hover:text-ink">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="rounded-3xl border border-line bg-card p-2 focus-within:border-ink/50">
          <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={3500}
            placeholder={voice.listening ? "Je vous écoute… parlez aussi longtemps que vous voulez" : "Que voulez-vous changer ? Vous pouvez écrire plusieurs choses à la fois."}
            onKeyDown={(e) => {
              // Sur ordinateur, Entrée envoie (Maj+Entrée = nouvelle ligne). Sur téléphone, Entrée va à la ligne.
              if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(text); }
            }}
            className="block max-h-[40vh] min-h-[52px] w-full resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none" />
          <div className="flex items-center gap-2">
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => attach(e.target.files)} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Ajouter une photo" title="Ajouter une photo"
            className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-ink/40 hover:text-ink disabled:opacity-30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          {voice.supported && (
            <button type="button" disabled={busy} onClick={() => (voice.listening ? voice.stop() : voice.start(text, "long"))}
              aria-label={voice.listening ? "Arrêter la dictée" : "Parler"} title={voice.listening ? "Arrêter la dictée" : "Parler"}
              aria-pressed={voice.listening}
              className={`relative grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full border transition disabled:opacity-30 ${
                voice.listening ? "border-clic bg-clic text-white" : "border-line text-muted hover:border-ink/40 hover:text-ink"}`}>
              {voice.listening && <span className="absolute inset-0 animate-ping rounded-full bg-clic/40" aria-hidden />}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="relative">
                {voice.listening
                  ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
                  : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
              </svg>
            </button>
          )}
            <span className="flex-1 truncate text-right text-[11px] text-muted">{text.length > 2800 ? `${3500 - text.length} caractères restants` : ""}</span>
          <button disabled={busy || !text.trim()} aria-label="Envoyer"
            className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full bg-clic text-xl text-white disabled:opacity-30">
            ↑
          </button>
          </div>
        </form>
        {voice.listening && talk === "off" && <p className="mt-2 text-center text-xs text-clic">Je vous écoute. Prenez votre temps, puis touchez ■ quand vous avez fini. Vous pourrez corriger avant d&apos;envoyer.</p>}
        {voice.error && <p className="mt-2 text-center text-xs text-red-400">{voice.error}</p>}
      </div>
    </div>
  );
}

/* ---------- Modifier moi-même ---------- */

type ManualProps = {
  id: string;
  content: SiteContent;
  edit: (fn: (d: SiteContent) => void) => void;
  addPhotos: (urls: string[], asCover?: boolean) => Promise<void>;
  daily: React.ReactNode;
};

function ManualPanel({ id, content: c, edit, addPhotos, daily }: ManualProps) {
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [photoError, setPhotoError] = useState("");

  async function addFiles(files: FileList | null, asCover = false) {
    if (!files?.length || upload) return;
    const list = Array.from(files).slice(0, Math.max(0, MAX_PHOTOS - c.photos.length));
    if (!list.length) return setPhotoError(`${MAX_PHOTOS} photos au maximum. Retirez-en une pour en ajouter une autre.`);
    setPhotoError("");
    const urls: string[] = [];
    setUpload({ done: 0, total: list.length });
    for (const f of list) {
      try {
        urls.push(await uploadPhoto(f, id));
      } catch (e) {
        setPhotoError(friendlyError(e, "L'envoi d'une photo a échoué."));
      }
      setUpload({ done: urls.length, total: list.length });
    }
    if (urls.length) {
      await addPhotos(urls, asCover);
      celebrate(asCover ? "Photo de fond changée" : urls.length > 1 ? `${urls.length} photos ajoutées` : "Photo ajoutée");
    }
    setUpload(null);
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4 pb-16">
      {daily}
      <Block title="Style" open>
        <div className="grid grid-cols-5 gap-2">
          {THEME_LABELS.map((t) => (
            <button key={t.id} onClick={() => edit((d) => { d.theme = t.id; })} aria-pressed={c.theme === t.id}
              className={`rounded-xl border p-1.5 text-[11px] ${c.theme === t.id ? "border-clic" : "border-line"}`}>
              <span className="mb-1 flex h-8 overflow-hidden rounded-lg">
                <span className="flex-1" style={{ background: t.colors[0] }} />
                <span className="w-1/3" style={{ background: t.colors[1] }} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </Block>

      <Block title="Couleurs et relief">
        <ColorStudio siteId={id} base={THEMES[c.theme]?.colors ?? THEMES.bistrot.colors} look={c.look}
          onChange={(look) => edit((d) => { d.look = look; })} />
      </Block>

      <Block title="Nom et accroche" open>
        <Field label="Nom du commerce" value={c.brand.name} onChange={(v) => edit((d) => { d.brand.name = v; })} />
        <Field label="Signature" value={c.brand.tagline} onChange={(v) => edit((d) => { d.brand.tagline = v; })} />
        <Field label="Petite ligne au-dessus du titre" value={c.hero.eyebrow} onChange={(v) => edit((d) => { d.hero.eyebrow = v; })} />
        <Field label="Grand titre" area value={c.hero.title} onChange={(v) => edit((d) => { d.hero.title = v; })} />
        <Field label="Texte d'accroche" area value={c.hero.subtitle} onChange={(v) => edit((d) => { d.hero.subtitle = v; })} />
        <Field label="Texte du bouton" value={c.hero.cta} onChange={(v) => edit((d) => { d.hero.cta = v; })} />
      </Block>

      <Block title="Photos" open>
        <div className="relative overflow-hidden rounded-2xl border border-line">
          {c.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photos[0]} alt="" referrerPolicy="no-referrer" className="h-36 w-full object-cover" />
          ) : (
            <div className="h-36 w-full bg-gradient-to-br from-white/[.06] to-transparent" />
          )}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3">
            <p className="text-sm font-medium text-white">Photo de fond</p>
            <p className="text-xs text-white/70">{c.photos[0] ? "En grand, tout en haut de votre site." : "Ajoutez une belle photo de votre commerce : elle s'affiche en grand, tout en haut."}</p>
            <label className={`mt-2 inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full bg-clic px-3.5 py-1.5 text-xs font-medium text-white ${upload ? "pointer-events-none opacity-60" : ""}`}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { addFiles(e.target.files, true); e.target.value = ""; }} />
              {c.photos[0] ? "Changer la photo de fond" : "Choisir une photo de fond"}
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {c.photos.map((src, i) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-clic px-2 py-0.5 text-[10px] font-medium text-white">Fond</span>}
              <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                {i > 0 && (
                  <button title="Mettre en photo de fond" aria-label="Mettre en photo de fond" onClick={() => edit((d) => { d.photos.splice(i, 1); d.photos.unshift(src); })}
                    className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">★</button>
                )}
                <button title="Retirer" aria-label="Retirer cette photo" onClick={() => edit((d) => { d.photos.splice(i, 1); })}
                  className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">✕</button>
              </div>
            </div>
          ))}
          {c.photos.length < MAX_PHOTOS && (
            <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-center text-xs text-muted transition hover:border-clic hover:text-ink ${upload ? "pointer-events-none" : ""}`}>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              {upload ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-clic" />
                  Envoi {Math.min(upload.done + 1, upload.total)}/{upload.total}
                </>
              ) : (
                <>
                  <span className="text-2xl leading-none text-clic">+</span>
                  Ajouter des photos
                </>
              )}
            </label>
          )}
        </div>
        <p className="text-xs text-muted">La photo marquée « Fond » s&apos;affiche en grand en haut de votre site, avec un voile sombre pour que le texte reste lisible. Touchez ★ sur une autre photo pour la mettre en fond.</p>
        {photoError && <p role="alert" className="text-sm text-red-400">{photoError}</p>}
      </Block>

      <Block title="Points forts">
        {c.highlights.map((h, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line p-3">
            <Field label={`Point fort ${i + 1}`} value={h.title} onChange={(v) => edit((d) => { d.highlights[i].title = v; })} />
            <Field label="Texte" area value={h.text} onChange={(v) => edit((d) => { d.highlights[i].text = v; })} />
          </div>
        ))}
      </Block>

      <Block title="Votre histoire">
        <Field label="Titre" value={c.about.title} onChange={(v) => edit((d) => { d.about.title = v; })} />
        {c.about.paragraphs.map((p, i) => (
          <Field key={i} label={`Paragraphe ${i + 1}`} area value={p} onChange={(v) => edit((d) => { d.about.paragraphs[i] = v; })} />
        ))}
      </Block>

      <Block title={c.offer.title || "Votre offre"}>
        <Field label="Titre de la section" value={c.offer.title} onChange={(v) => edit((d) => { d.offer.title = v; })} />
        <Field label="Introduction" area value={c.offer.intro} onChange={(v) => edit((d) => { d.offer.intro = v; })} />
        {c.offer.categories.map((cat, ci) => (
          <div key={ci} className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Catégorie" value={cat.name} onChange={(v) => edit((d) => { d.offer.categories[ci].name = v; })} />
              </div>
              <Remove onClick={() => edit((d) => { d.offer.categories.splice(ci, 1); })} />
            </div>
            {cat.items.map((it, ii) => (
              <div key={ii} className="rounded-lg bg-sand/60 p-2.5">
                <div className="flex gap-2">
                  <div className="flex-1"><Field label="Nom" value={it.name} onChange={(v) => edit((d) => { d.offer.categories[ci].items[ii].name = v; })} /></div>
                  <div className="w-24"><Field label="Prix" value={it.price} onChange={(v) => edit((d) => { d.offer.categories[ci].items[ii].price = v; })} /></div>
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1"><Field label="Description" value={it.description} onChange={(v) => edit((d) => { d.offer.categories[ci].items[ii].description = v; })} /></div>
                  <Remove onClick={() => edit((d) => { d.offer.categories[ci].items.splice(ii, 1); })} />
                </div>
              </div>
            ))}
            <Add onClick={() => edit((d) => { d.offer.categories[ci].items.push({ name: "Nouveau", description: "", price: "" }); })}>Ajouter une ligne</Add>
          </div>
        ))}
        <Add onClick={() => edit((d) => { d.offer.categories.push({ name: "Nouvelle catégorie", items: [] }); })}>Ajouter une catégorie</Add>
      </Block>

      <Block title="Horaires">
        {c.hours.map((h, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1"><Field label="Jours" value={h.days} onChange={(v) => edit((d) => { d.hours[i].days = v; })} /></div>
            <div className="flex-1"><Field label="Heures" value={h.time} onChange={(v) => edit((d) => { d.hours[i].time = v; })} /></div>
            <Remove onClick={() => edit((d) => { d.hours.splice(i, 1); })} />
          </div>
        ))}
        <Add onClick={() => edit((d) => { d.hours.push({ days: "", time: "" }); })}>Ajouter une ligne</Add>
      </Block>

      <Block title="Contact">
        <Field label="Adresse" value={c.contact.address} onChange={(v) => edit((d) => { d.contact.address = v; })} />
        <Field label="Téléphone" type="tel" value={c.contact.phone} onChange={(v) => edit((d) => { d.contact.phone = v; })} />
        <Field label="E-mail" type="email" value={c.contact.email} onChange={(v) => edit((d) => { d.contact.email = v; })} />
        <Field label="Instagram" value={c.links?.instagram ?? ""} onChange={(v) => edit((d) => { d.links = { ...d.links, instagram: v }; })} />
        <Field label="Facebook" value={c.links?.facebook ?? ""} onChange={(v) => edit((d) => { d.links = { ...d.links, facebook: v }; })} />
      </Block>

      <Block title="Fin de page">
        <Field label="Titre" value={c.closing.title} onChange={(v) => edit((d) => { d.closing.title = v; })} />
        <Field label="Texte" area value={c.closing.text} onChange={(v) => edit((d) => { d.closing.text = v; })} />
      </Block>

      <DeleteSite id={id} name={c.brand.name} />
    </div>
  );
}

/** Supprimer le site (deux gestes, pour éviter une fausse manip). */
function DeleteSite({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "ask" | "busy">("idle");
  const [error, setError] = useState("");
  async function remove() {
    setStep("busy");
    setError("");
    const res = await fetch(`/api/sites/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.push("/tableau-de-bord");
      router.refresh();
      return;
    }
    const d = await res?.json().catch(() => ({}));
    setError(d?.error || "Suppression impossible. Vérifiez votre connexion.");
    setStep("ask");
  }
  return (
    <div className="pt-6 text-center text-sm">
      {step === "idle" ? (
        <button onClick={() => setStep("ask")} className="text-muted underline underline-offset-4 hover:text-red-400">Supprimer ce site</button>
      ) : (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-left">
          <p className="font-medium">Supprimer « {name} » ?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">Le site, ses photos, ses réservations et ses commandes seront effacés pour toujours. S&apos;il est en ligne, il disparaît d&apos;Internet.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={remove} disabled={step === "busy"} className="rounded-full bg-red-500 px-4 py-2 font-medium text-white disabled:opacity-60">
              {step === "busy" ? "Suppression…" : "Oui, supprimer"}
            </button>
            <button onClick={() => setStep("idle")} className="rounded-full border border-line px-4 py-2">Non, garder</button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Block({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 font-medium">
        {title}
        <span className="text-clic transition group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[15px] outline-none focus:border-ink/60";

function Field({ label, value, onChange, area, type = "text" }: { label: string; value: string; onChange: (v: string) => void; area?: boolean; type?: "text" | "tel" | "email" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {area ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y leading-relaxed`} />
      ) : (
        <input type={type} inputMode={type === "text" ? undefined : type} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </label>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Supprimer" className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-red-400">
      ✕
    </button>
  );
}

function Add({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-dashed border-line py-2.5 text-sm text-muted hover:border-ink/40 hover:text-ink">
      + {children}
    </button>
  );
}

function Waves() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </svg>
  );
}
