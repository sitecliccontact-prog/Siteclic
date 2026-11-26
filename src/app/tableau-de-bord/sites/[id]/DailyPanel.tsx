"use client";

import { useRef, useState } from "react";
import { celebrate } from "@/components/Celebration";
import { useDictation } from "@/lib/hooks/useDictation";
import { bookingEnabled, specialIsFresh, type SiteContent } from "@/lib/site/schema";
import { uploadVideo } from "@/lib/site/videos";
import { AiOfferCard } from "./AiOfferCard";
import { FloorEditor } from "./FloorEditor";
import { speakNatural } from "@/lib/hooks/voice";

/* Menu du jour + réservations : mis en ligne tout de suite, sans IA (gratuit). */

type Props = { id: string; content: SiteContent; onSaved: (c: SiteContent) => void; beforeSave: () => Promise<void> };

async function saveSettings(id: string, body: object) {
  const res = await fetch(`/api/sites/${id}/reglages`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Enregistrement impossible. Réessayez.");
  return data.content as SiteContent;
}

export function DailyPanel({ id, content, onSaved, beforeSave }: Props) {
  const fresh = specialIsFresh(content);
  const [title, setTitle] = useState(content.special?.title || "Menu du jour");
  const [text, setText] = useState(fresh ? content.special?.text ?? "" : "");
  const [busy, setBusy] = useState<"menu" | "booking" | "assistant" | "video" | "floor" | "notes" | null>(null);
  const [msg, setMsg] = useState("");
  const voice = useDictation(setText);
  const booking = bookingEnabled(content);
  const assistant = content.assistant?.enabled ?? false;
  const video = { enabled: false, url: "", clips: [] as string[], ...content.video };
  const fileRef = useRef<HTMLInputElement>(null);
  const clipRef = useRef<HTMLInputElement>(null);

  async function sendVideo(file: File | undefined) {
    if (!file) return;
    setBusy("video");
    setMsg("Envoi de la vidéo… (gardez l'appli ouverte)");
    try {
      const url = await uploadVideo(file, id);
      setBusy(null);
      await run("video", { video: { ...video, enabled: true, url } }, "Vidéo en ligne ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Envoi impossible.");
      setBusy(null);
    }
  }

  // Petits clips : envoyés un par un, puis SiteClic les monte en film.
  async function sendClips(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, 5 - video.clips.length);
    if (!list.length) return;
    setBusy("video");
    const added: string[] = [];
    try {
      for (const [k, f] of list.entries()) {
        setMsg(`Envoi du clip ${k + 1} sur ${list.length}… (gardez l'appli ouverte)`);
        added.push(await uploadVideo(f, id));
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Envoi impossible.");
    }
    setBusy(null);
    if (added.length) {
      await run("video", { video: { enabled: true, url: "", clips: [...video.clips, ...added] } },
        added.length > 1 ? `${added.length} clips ajoutés ✓ Votre film est prêt.` : "Clip ajouté ✓ Votre film est prêt.");
    }
  }

  const [notes, setNotes] = useState(content.assistant?.notes ?? "");
  const notesVoice = useDictation(setNotes);
  async function run(kind: "menu" | "booking" | "assistant" | "video" | "floor" | "notes", body: object, ok: string) {
    setBusy(kind);
    setMsg("");
    try {
      await beforeSave();
      onSaved(await saveSettings(id, body));
      setMsg(ok);
      if (ok.includes("✓")) celebrate(ok.split(" ✓")[0].replace("C'est sur votre site", "Menu du jour en ligne"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-clic/40 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">Menu du jour</p>
          {fresh && <span className="flex items-center gap-1.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Affiché aujourd&apos;hui</span>}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">Écrivez ou dictez votre menu : il apparaît en haut de votre site, tout de suite, et disparaît tout seul le lendemain.</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="Titre"
          className="mt-3 w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[15px] outline-none focus:border-ink/60" />
        <div className="relative mt-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1200}
            placeholder={voice.listening ? "Je vous écoute…" : "Ex.\nEntrée : velouté de potimarron\nPlat : daube provençale\nDessert : tarte au citron\nFormule 18 €"}
            className="w-full resize-y rounded-xl border border-line bg-cream px-3 py-2.5 pr-14 text-[15px] leading-relaxed outline-none focus:border-ink/60" />
          {voice.supported && (
            <button type="button" onClick={() => (voice.listening ? voice.stop() : voice.start(text, "long"))}
              aria-label={voice.listening ? "Arrêter la dictée" : "Dicter le menu"}
              className={`absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full border transition ${voice.listening ? "border-clic bg-clic text-white" : "border-line text-muted hover:text-ink"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {voice.listening ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
              </svg>
            </button>
          )}
        </div>
        {voice.error && <p className="mt-1 text-xs text-red-400">{voice.error}</p>}
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={busy !== null || !text.trim()}
            onClick={() => run("menu", { special: { title, text } }, "C'est sur votre site ✓")}
            className="flex-1 rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">
            {busy === "menu" ? "Envoi…" : fresh ? "Mettre à jour" : "Afficher sur mon site"}
          </button>
          {fresh && (
            <button type="button" disabled={busy !== null} onClick={() => { setText(""); run("menu", { special: null }, "Menu du jour retiré."); }}
              className="text-sm text-muted underline underline-offset-4">Retirer</button>
          )}
        </div>
      </div>

      <Switch title="Réservation de table" on={booking} disabled={busy !== null}
        text="Un bouton « Réserver » sur votre site. Les demandes arrivent dans votre tableau des réservations."
        onToggle={() => run("booking", { booking: { enabled: !booking } }, booking ? "Réservation désactivée." : "Réservation activée ✓")} />
      <Switch title="Assistant IA pour vos clients" on={assistant} disabled={busy !== null}
        text="Un bouton « Une question ? » sur votre site : l'IA répond à l'écrit ou à l'oral (horaires, carte) et prend les réservations. Avec l'option Essentiel ou Pro ci-dessous."
        onToggle={() => run("assistant", { assistant: { enabled: !assistant } }, assistant ? "Assistant désactivé." : "Assistant activé ✓ Essayez-le dans « Voir ».")} />
      {(assistant || booking) && <AiOfferCard id={id} />}
      {(assistant || booking) && (
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="font-medium">Voix de l&apos;assistant</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(["homme", "femme"] as const).map((v) => (
              <button key={v} type="button" disabled={busy !== null}
                onClick={() => run("notes", { assistant: { voice: v } }, v === "homme" ? "Voix d'homme choisie ✓" : "Voix de femme choisie ✓")}
                className={`rounded-full border px-4 py-2 text-sm ${(content.assistant?.voice ?? "homme") === v ? "border-clic bg-clic/15 text-ink" : "border-line text-muted"}`}>
                {v === "homme" ? "Homme" : "Femme"}
              </button>
            ))}
            <button type="button" className="ml-auto rounded-full border border-line px-4 py-2 text-sm hover:border-ink/50"
              onClick={async () => {
                const r = await fetch("/api/voix/bonjour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand: content.brand.name.slice(0, 60), booking }) }).catch(() => null);
                const d = r?.ok ? await r.json() : { text: `Bonjour, ${content.brand.name}, je vous écoute !`, sig: "" };
                void speakNatural(d.text, d.sig, content.assistant?.voice ?? "homme");
              }}>
              ▶ Écouter
            </button>
          </div>
          <p className="mt-5 font-medium">Ce que l&apos;assistant doit savoir</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            L&apos;assistant connaît déjà tout votre site : carte, prix, horaires, menu du jour. Ajoutez ici le reste, comme vous l&apos;expliqueriez à un nouveau serveur : allergènes, parking, groupes, chiens, plats végétariens…
          </p>
          {content.hours.length === 0 && (
            <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              Votre site n&apos;a pas encore d&apos;horaires. Ajoutez-les dans « Horaires » plus bas (ou écrivez-les ici) pour que l&apos;assistant puisse répondre et vérifier les réservations.
            </p>
          )}
          <div className="relative mt-3">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={3000}
              placeholder={"Ex.\nOuvert du mardi au dimanche, 12h-14h30 et 19h-22h30.\nParking gratuit à 50 m.\nPlats sans gluten sur demande.\nGroupes jusqu'à 20 personnes."}
              className="w-full resize-y rounded-xl border border-line bg-cream px-3 py-2.5 pr-14 text-[15px] leading-relaxed outline-none focus:border-ink/60" />
            {notesVoice.supported && (
              <button type="button" onClick={() => (notesVoice.listening ? notesVoice.stop() : notesVoice.start(notes, "long"))}
                aria-label={notesVoice.listening ? "Arrêter la dictée" : "Dicter"}
                className={`absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full border transition ${notesVoice.listening ? "border-clic bg-clic text-white" : "border-line text-muted hover:text-ink"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {notesVoice.listening ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
                </svg>
              </button>
            )}
          </div>
          <button type="button" disabled={busy !== null || notes === (content.assistant?.notes ?? "")}
            onClick={() => run("notes", { assistant: { notes } }, "C'est noté ✓ L'assistant le sait maintenant.")}
            className="mt-2 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">
            {busy === "notes" ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
      {booking && (
        <FloorEditor enabled={content.floor?.enabled ?? false} tables={content.floor?.tables ?? []} busy={busy !== null}
          onSave={(floor) => run("floor", { floor }, floor.enabled ? "Plan de salle en ligne ✓" : "Plan de salle retiré.")} />
      )}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Vidéo de présentation</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Une vidéo qui se lance toute seule sur votre site, sans le son. Pas de vidéo montée ? SiteClic fait le film pour vous avec vos petits clips ou vos photos.</p>
          </div>
          <button type="button" role="switch" aria-checked={video.enabled} aria-label="Vidéo de présentation" disabled={busy !== null}
            onClick={() => run("video", { video: { ...video, enabled: !video.enabled } }, video.enabled ? "Vidéo retirée du site." : "Vidéo ajoutée ✓ Regardez dans « Voir ».")}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${video.enabled ? "bg-clic" : "bg-white/15"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${video.enabled ? "left-6" : "left-1"}`} />
          </button>
        </div>
        {video.enabled && (video.url ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">Votre vidéo est sur le site.</p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()}
                className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink/60 disabled:opacity-40">
                {busy === "video" ? "Envoi…" : "Changer de vidéo"}
              </button>
              <button type="button" disabled={busy !== null} onClick={() => run("video", { video: { ...video, url: "" } }, "Film automatique remis ✓")}
                className="text-sm text-muted underline underline-offset-4">Utiliser le film automatique</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-clic/30 bg-clic/5 p-3">
              <p className="text-sm font-medium">Film automatique</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Filmez 3 à 5 petits moments de 5 secondes avec votre téléphone : la salle, un plat qu&apos;on dresse, l&apos;équipe, la devanture…
                SiteClic les monte en film avec vos textes et votre nom. Sans clip, le film est fait avec vos photos.
              </p>
              {video.clips.length > 0 && (
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {video.clips.map((c, k) => (
                    <div key={c} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-black">
                      <video src={`${c}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      <button type="button" disabled={busy !== null} aria-label={`Retirer le clip ${k + 1}`}
                        onClick={() => run("video", { video: { ...video, clips: video.clips.filter((x) => x !== c) } }, "Clip retiré.")}
                        className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs text-white">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {video.clips.length < 5 && (
                <button type="button" disabled={busy !== null} onClick={() => clipRef.current?.click()}
                  className="mt-3 w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40">
                  {busy === "video" ? "Envoi…" : video.clips.length ? `+ Ajouter un clip (${video.clips.length}/5)` : "+ Ajouter mes petits clips"}
                </button>
              )}
            </div>
            <button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()}
              className="text-sm text-muted underline underline-offset-4">Ou mettre une vidéo déjà montée</button>
          </div>
        ))}
        <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { void sendVideo(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={clipRef} type="file" accept="video/*" multiple hidden onChange={(e) => { void sendClips(e.target.files); e.target.value = ""; }} />
      </div>
      {msg && <p className="px-1 text-xs text-muted" role="status">{msg}</p>}
    </div>
  );
}

function Switch({ title, text, on, disabled, onToggle }: { title: string; text: string; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={title} disabled={disabled} onClick={onToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-clic" : "bg-white/15"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
