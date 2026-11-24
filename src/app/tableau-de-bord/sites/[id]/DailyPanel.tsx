"use client";

import { useState } from "react";
import { useDictation } from "@/lib/hooks/useDictation";
import { bookingEnabled, specialIsFresh, type SiteContent } from "@/lib/site/schema";

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
  const [busy, setBusy] = useState<"menu" | "booking" | null>(null);
  const [msg, setMsg] = useState("");
  const voice = useDictation(setText);
  const booking = bookingEnabled(content);

  async function run(kind: "menu" | "booking", body: object, ok: string) {
    setBusy(kind);
    setMsg("");
    try {
      await beforeSave();
      onSaved(await saveSettings(id, body));
      setMsg(ok);
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
            <button type="button" onClick={() => (voice.listening ? voice.stop() : voice.start(text))}
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

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <p className="font-medium">Réservation de table</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">Un bouton « Réserver » sur votre site. Les demandes arrivent dans « Mes sites ».</p>
        </div>
        <button type="button" role="switch" aria-checked={booking} disabled={busy !== null}
          onClick={() => run("booking", { booking: { enabled: !booking } }, booking ? "Réservation désactivée." : "Réservation activée ✓")}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${booking ? "bg-clic" : "bg-white/15"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${booking ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {msg && <p className="px-1 text-xs text-muted" role="status">{msg}</p>}
    </div>
  );
}
