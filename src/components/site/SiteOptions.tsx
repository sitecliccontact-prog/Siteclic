"use client";

import { useEffect, useState } from "react";
import type { SiteContent } from "@/lib/site/schema";
import { dateLong } from "@/lib/site/dates";

/* Options du site : événements à places limitées, candidatures (offres d'emploi), inscription newsletter / SMS. */

type Ev = NonNullable<SiteContent["events"]>[number];
type Job = NonNullable<SiteContent["jobs"]>["items"][number];
const preview = (slug?: string) => !slug || slug.startsWith("exemple-");

/** Ouvre la fenêtre quand on touche un lien qui commence par le préfixe (ex. #evenement-ab12) et renvoie la suite. */
function usePrefixOpener(prefix: string) {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    const onClick = (e: Event) => {
      const a = (e.target as HTMLElement).closest(`a[href^="${prefix}"]`);
      if (!a) return;
      e.preventDefault();
      setKey(a.getAttribute("href")!.slice(prefix.length));
    };
    document.addEventListener("click", onClick);
    if (window.location.hash.startsWith(prefix)) setKey(window.location.hash.slice(prefix.length));
    return () => document.removeEventListener("click", onClick);
  }, [prefix]);
  return [key, setKey] as const;
}

/** Places restantes affichées sur les cartes des événements. */
export function EventSeats({ slug, events }: { slug?: string; events: Ev[] }) {
  useEffect(() => {
    if (preview(slug) || !events.some((e) => e.seats > 0)) return;
    fetch(`/api/evenement?slug=${slug}`).then((r) => r.json()).then(({ taken }) => {
      for (const ev of events) {
        if (!ev.seats) continue;
        const left = Math.max(0, ev.seats - (taken?.[ev.id] ?? 0));
        document.querySelectorAll<HTMLElement>(`[data-seats="${ev.id}"]`).forEach((el) => {
          el.textContent = left ? `${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}` : "Complet";
          el.classList.toggle("is-full", !left);
        });
      }
    }).catch(() => {});
  }, [slug, events]);
  return null;
}

export function EventDialog({ slug, brand, events }: { slug?: string; brand: string; events: Ev[] }) {
  const [id, setId] = usePrefixOpener("#evenement-");
  const ev = events.find((e) => e.id === id);
  const [people, setPeople] = useState(2);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const close = () => { setId(null); setDone(""); setError(""); };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ev) return;
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "");
    setError("");
    if (preview(slug)) return setDone(`Ceci est un aperçu : une fois le site en ligne, ${brand} recevra cette réservation.`);
    setBusy(true);
    try {
      const res = await fetch("/api/evenement", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, event: ev.id, name, phone: String(f.get("phone") ?? ""), people, message: String(f.get("message") ?? "") }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "La réservation n'est pas passée.");
      setDone(`C'est réservé, ${name.split(" ")[0]} ! ${people} place${people > 1 ? "s" : ""} pour « ${ev.title} ». À très vite chez ${brand}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La réservation n'est pas passée.");
    } finally {
      setBusy(false);
    }
  }

  if (!ev) return null;
  return (
    <div className="s-modal" role="dialog" aria-modal="true" aria-label={ev.title} onClick={close}>
      <div className="s-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="s-modal-close" onClick={close} aria-label="Fermer">×</button>
        {done ? (
          <div className="s-modal-done">
            <p className="s-display s-modal-title">{done}</p>
            <button type="button" className="s-btn" onClick={close}>Fermer</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="s-eyebrow">{dateLong(ev.date)} · {ev.time.replace(":", "h")}</p>
            <h2 className="s-display s-modal-title">{ev.title}</h2>
            {ev.price && <p className="s-modal-note">{ev.price} par personne{ev.seats ? " · places limitées" : ""}</p>}
            <p className="s-order-cat">Nombre de places</p>
            <div className="s-chips">
              {[1, 2, 3, 4, 5, 6, 8].map((n) => <button key={n} type="button" className={people === n ? "on" : ""} onClick={() => setPeople(n)}>{n}</button>)}
            </div>
            <div className="s-field-row">
              <label className="s-field"><span>Nom</span><input name="name" autoComplete="name" required maxLength={80} /></label>
              <label className="s-field"><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" required minLength={6} maxLength={30} /></label>
            </div>
            <label className="s-field"><span>Message <em>(facultatif)</em></span><textarea name="message" rows={2} maxLength={300} /></label>
            {error && <p className="s-modal-error" role="alert">{error}</p>}
            <button className="s-btn s-btn-full" disabled={busy}>{busy ? "Envoi…" : `Réserver ${people} place${people > 1 ? "s" : ""}`}</button>
            <p className="s-modal-note">{ev.price ? "Règlement sur place le soir même." : "Gratuit, sans engagement."} En cas d&apos;empêchement, merci de prévenir.</p>
          </form>
        )}
      </div>
    </div>
  );
}

export function JobDialog({ slug, brand, jobs }: { slug?: string; brand: string; jobs: Job[] }) {
  const [key, setKey] = usePrefixOpener("#postuler");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState("");
  const job = key ? jobs[Number(key.slice(1))] ?? null : null;
  const close = () => { setKey(null); setDone(""); setError(""); setFile(""); };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    f.set("slug", slug ?? "");
    f.set("job", job?.title ?? "");
    setError("");
    if (preview(slug)) return setDone(`Ceci est un aperçu : une fois le site en ligne, ${brand} recevra votre candidature.`);
    setBusy(true);
    try {
      const res = await fetch("/api/candidature", { method: "POST", body: f });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "La candidature n'est pas passée.");
      setDone(`Merci ${String(f.get("name")).split(" ")[0]} ! Votre candidature est bien arrivée chez ${brand}. Nous vous recontactons très vite.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La candidature n'est pas passée.");
    } finally {
      setBusy(false);
    }
  }

  if (key === null) return null;
  return (
    <div className="s-modal" role="dialog" aria-modal="true" aria-label="Postuler" onClick={close}>
      <div className="s-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="s-modal-close" onClick={close} aria-label="Fermer">×</button>
        {done ? (
          <div className="s-modal-done">
            <p className="s-display s-modal-title">{done}</p>
            <button type="button" className="s-btn" onClick={close}>Fermer</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="s-eyebrow">On recrute</p>
            <h2 className="s-display s-modal-title">{job ? `${job.title}${job.kind ? ` · ${job.kind}` : ""}` : `Rejoindre ${brand}`}</h2>
            <div className="s-field-row">
              <label className="s-field"><span>Nom</span><input name="name" autoComplete="name" required maxLength={80} /></label>
              <label className="s-field"><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
            </div>
            <label className="s-field"><span>E-mail <em>(facultatif)</em></span><input name="email" type="email" autoComplete="email" maxLength={120} /></label>
            <label className="s-field"><span>Quelques mots sur vous</span><textarea name="message" rows={3} maxLength={1500} placeholder="Votre expérience, vos disponibilités…" /></label>
            <label className="s-file">
              <input type="file" name="cv" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
              <span>{file ? `📎 ${file}` : "📎 Joindre mon CV (PDF ou photo, facultatif)"}</span>
            </label>
            {error && <p className="s-modal-error" role="alert">{error}</p>}
            <button className="s-btn s-btn-full" disabled={busy}>{busy ? "Envoi…" : "Envoyer ma candidature"}</button>
            <p className="s-modal-note">Vos informations sont transmises uniquement à {brand}.</p>
          </form>
        )}
      </div>
    </div>
  );
}

export function NewsletterForm({ slug, brand, perk }: { slug?: string; brand: string; perk: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    if (preview(slug)) return setDone("Ceci est un aperçu : une fois le site en ligne, l'inscription sera enregistrée.");
    setBusy(true);
    try {
      const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, contact: String(f.get("contact") ?? ""), consent: f.get("consent") === "on" }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Inscription impossible.");
      setDone(d.kind === "sms" ? `C'est noté ! Vous recevrez les nouvelles de ${brand} par SMS.` : `C'est noté ! Vous recevrez les nouvelles de ${brand} par e-mail.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="s-news-done s-display" role="status">{done}</p>;
  return (
    <form className="s-news-form" onSubmit={submit}>
      <div className="s-news-row">
        <input name="contact" required minLength={6} maxLength={120} placeholder="E-mail ou téléphone" aria-label="E-mail ou téléphone" autoComplete="email" />
        <button className="s-btn" disabled={busy}>{busy ? "…" : "Je m'inscris"}</button>
      </div>
      <label className="s-news-consent"><input type="checkbox" name="consent" required /> J&apos;accepte de recevoir les nouvelles et offres de {brand}. Désinscription à tout moment en répondant STOP.</label>
      {perk && <p className="s-news-perk">🎁 {perk}</p>}
      {error && <p className="s-modal-error" role="alert">{error}</p>}
    </form>
  );
}
