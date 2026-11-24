"use client";

import { useEffect, useRef, useState } from "react";

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
