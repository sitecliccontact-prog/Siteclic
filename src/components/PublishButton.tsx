"use client";

import { useEffect, useState } from "react";

export type PublishState = { online: boolean; slug: string | null; hasChanges: boolean };

type Props = {
  id: string;
  initial: PublishState;
  /** Appelé avant la publication (ex. pour enregistrer la dernière frappe). */
  beforePublish?: () => Promise<void>;
  onPublished?: () => void;
  compact?: boolean;
};

/** Bouton « Mettre en ligne » + fenêtre avec le lien du site à partager. */
export function PublishButton({ id, initial, beforePublish, onPublished, compact }: Props) {
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"publish" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [justPublished, setJustPublished] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => setState((s) => ({ ...s, hasChanges: initial.hasChanges || s.hasChanges })), [initial.hasChanges]);

  const url = state.slug ? `${origin}/s/${state.slug}` : "";
  const shownUrl = url.replace(/^https?:\/\//, "");

  async function publish() {
    setBusy("publish");
    setError("");
    try {
      await beforePublish?.();
      const res = await fetch(`/api/sites/${id}/publier`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "La mise en ligne n'a pas fonctionné.");
      setState({ online: true, slug: data.slug, hasChanges: false });
      setJustPublished(true);
      setOpen(true);
      onPublished?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La mise en ligne n'a pas fonctionné.");
      setOpen(true);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError("");
    const res = await fetch(`/api/sites/${id}/publier`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return setError("Impossible de retirer le site. Réessayez.");
    setState((s) => ({ ...s, online: false }));
    setConfirmRemove(false);
    setOpen(false);
  }

  async function copy() {
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: "Mon site", url }).catch(() => {});
    else copy();
  }

  const label = busy === "publish"
    ? "Mise en ligne…"
    : state.online
      ? state.hasChanges ? "Publier les modifications" : "En ligne"
      : "Mettre en ligne";

  return (
    <>
      <button
        onClick={() => (state.online && !state.hasChanges ? (setJustPublished(false), setOpen(true)) : publish())}
        disabled={busy !== null}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full font-medium transition disabled:opacity-60 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        } ${state.online && !state.hasChanges ? "border border-white/15 bg-white/5 text-[#f5f4f0]" : "bg-[#ff5b1f] text-white hover:bg-[#e84a10]"}`}
      >
        {state.online && !state.hasChanges && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="rise w-full max-w-md select-text rounded-3xl border border-white/10 bg-[#141417] p-7 text-[#f5f4f0] shadow-2xl">
            {error && !state.online ? (
              <>
                <h2 className="font-display text-2xl font-bold tracking-tight">Pas encore en ligne</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-white/60">{error}</p>
                <button onClick={() => setOpen(false)} className="mt-6 w-full rounded-full bg-white/10 py-3 font-medium">Fermer</button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#ff5b1f]">
                  {justPublished ? "C'est en ligne" : "Votre site"}
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
                  {justPublished ? "Votre site est visible par tous." : "Votre site est en ligne."}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-white/60">
                  Partagez ce lien à vos clients, sur Google, Instagram ou WhatsApp.
                </p>

                <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 p-2 pl-4">
                  <span className="min-w-0 flex-1 truncate text-sm">{shownUrl}</span>
                  <button onClick={copy} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/15">
                    {copied ? "Copié ✓" : "Copier"}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a href={url} target="_blank" rel="noopener"
                    className="rounded-full bg-[#ff5b1f] py-3 text-center font-medium text-white hover:bg-[#e84a10]">
                    Voir mon site
                  </a>
                  <button onClick={share} className="rounded-full border border-white/15 py-3 font-medium hover:border-white/40">
                    Partager
                  </button>
                </div>

                {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

                <div className="mt-6 border-t border-white/10 pt-4 text-center text-sm">
                  {confirmRemove ? (
                    <p className="text-white/60">
                      Votre site ne sera plus visible.{" "}
                      <button onClick={remove} disabled={busy !== null} className="font-medium text-red-400 underline underline-offset-4">
                        {busy === "remove" ? "Retrait…" : "Oui, le retirer"}
                      </button>{" "}
                      ·{" "}
                      <button onClick={() => setConfirmRemove(false)} className="underline underline-offset-4">Non</button>
                    </p>
                  ) : (
                    <div className="flex justify-between">
                      <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white">Fermer</button>
                      <button onClick={() => setConfirmRemove(true)} className="text-white/40 hover:text-white/70">
                        Retirer d&apos;Internet
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
