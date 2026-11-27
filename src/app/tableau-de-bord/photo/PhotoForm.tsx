"use client";

import { useRouter } from "next/navigation";
import { friendlyError, NeedsOffer } from "@/lib/errors";
import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/site/photos";
import { Generating } from "../creer/Wizard";

const STEPS = [
  "Nous regardons vos photos…",
  "Nous lisons votre enseigne, votre carte et vos prix…",
  "Nous écrivons vos textes…",
  "Nous choisissons le design qui vous ressemble…",
  "Nous mettons la dernière main à votre site…",
];

const IDEAS = ["Votre vitrine ou devanture", "Votre carte, menu ou ardoise (avec les prix)", "Un plat, un produit ou la salle", "Les horaires sur la porte"];

/** « Photo → site » : 1 à 4 photos, l'IA fait le reste. */
export function PhotoForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"choose" | "upload" | "ai">("choose");
  const [error, setError] = useState("");
  const [needsOffer, setNeedsOffer] = useState(false);

  function add(list: FileList | null) {
    const next = [...files, ...Array.from(list ?? []).filter((f) => f.type.startsWith("image/")).map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 4);
    setFiles(next);
    setError("");
  }

  async function go() {
    setError("");
    setStep("upload");
    try {
      const folder = `photo-${Date.now().toString(36)}`;
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadPhoto(f.file, folder));
      setStep("ai");
      const res = await fetch("/api/sites/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photos: urls, note }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && data.needsSubscription) throw new NeedsOffer(data.error);
      if (!res.ok) throw new Error(data.error || "La création a échoué. Réessayez.");
      router.push(`/apercu/${data.id}?nouveau=1`);
    } catch (e) {
      setNeedsOffer(e instanceof NeedsOffer);
      setError(friendlyError(e, "La création a échoué."));
      setStep("choose");
    }
  }

  if (step === "ai") return <Generating steps={STEPS} />;

  return (
    <div className="rise mx-auto max-w-xl">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Photo → site</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Prenez une photo. On fait le site.</h1>
      <p className="mt-3 text-muted">1 à 4 photos suffisent. L&apos;IA lit votre enseigne, votre carte et vos prix, puis crée un site complet en une minute.</p>

      <ul className="mt-6 grid grid-cols-2 gap-2 text-sm">
        {IDEAS.map((t, k) => (
          <li key={t} className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 py-3"><span className="text-clic">{k + 1}</span>{t}</li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {files.map((f, k) => (
          <div key={f.url} className="relative aspect-square overflow-hidden rounded-2xl bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="Retirer" onClick={() => setFiles(files.filter((_, j) => j !== k))}
              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-sm text-white">✕</button>
          </div>
        ))}
        {files.length < 4 && (
          <button type="button" onClick={() => input.current?.click()}
            className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-clic/50 text-3xl text-clic">+</button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <button type="button" onClick={() => input.current?.click()} className="mt-3 w-full rounded-full border border-line py-3 text-sm">
        📷 {files.length ? "Ajouter une autre photo" : "Prendre ou choisir des photos"}
      </button>

      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-medium">Un mot de plus ? <span className="text-muted">(facultatif)</span></span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={400}
          placeholder="Ex. Boulangerie à Sanary, ouverte depuis 1998, téléphone 04 94 …"
          className="w-full rounded-2xl border border-line bg-card px-4 py-3 outline-none focus:border-ink/60" />
      </label>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {error && needsOffer && (
        <a href="/abonnement?retour=/tableau-de-bord/photo" className="mt-3 block rounded-full bg-clic px-5 py-3 text-center font-medium text-white">Voir les tarifs</a>
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/tableau-de-bord")} className="rounded-full px-5 py-3 text-sm font-medium text-muted hover:text-ink">← Annuler</button>
        <button type="button" disabled={!files.length || step !== "choose"} onClick={go}
          className="rounded-full bg-clic px-7 py-3.5 font-medium text-white shadow-[0_10px_30px_-10px_rgba(255,91,31,.6)] disabled:opacity-30">
          {step === "upload" ? "Envoi des photos…" : "Créer mon site"}
        </button>
      </div>
    </div>
  );
}
