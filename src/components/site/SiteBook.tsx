"use client";

import { useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/site/schema";

/* Prise de rendez-vous (coiffeurs, instituts…) : prestation, personne, jour, créneau libre. S'ouvre avec tout lien vers #rendez-vous. */

type Appts = NonNullable<SiteContent["appointments"]>;
type Busy = { at_time: string; minutes: number; staff: string };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const parisToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

function nextDays(open: number[], n = 14) {
  const out: string[] = [];
  const start = new Date(`${parisToday()}T12:00:00Z`);
  for (let k = 0; out.length < n && k < 60; k++) {
    const d = new Date(start.getTime() + k * 86400000);
    if (open.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
const dayChip = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    wd: new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", ""),
    n: d.getUTCDate(),
    m: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(d).replace(".", ""),
  };
};

export function AppointmentDialog({ slug, brand, appts }: { slug?: string; brand: string; appts: Appts }) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState<number | null>(null);
  const [staff, setStaff] = useState("");
  const days = useMemo(() => nextDays(appts.days), [appts.days]);
  const [day, setDay] = useState(days[0] ?? parisToday());
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState<Busy[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onClick = (e: Event) => {
      if (!(e.target as HTMLElement).closest('a[href="#rendez-vous"]')) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    if (window.location.hash === "#rendez-vous") setOpen(true);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open || !slug || slug.startsWith("exemple-")) return;
    let alive = true;
    fetch(`/api/rdv?slug=${slug}&day=${day}`).then((r) => r.json()).then((d) => alive && setBusy(d.busy ?? [])).catch(() => {});
    return () => { alive = false; };
  }, [open, slug, day, done]);

  const svc = service === null ? null : appts.services[service];
  const team = Math.max(1, appts.staff.length);
  const slots = useMemo(() => {
    if (!svc) return [];
    const now = day === parisToday() ? toMin(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date())) + 30 : 0;
    const out: { t: string; free: boolean }[] = [];
    for (let m = toMin(appts.open); m + svc.minutes <= toMin(appts.close); m += 15) {
      if (m < now) continue;
      const over = busy.filter((b) => toMin(b.at_time) < m + svc.minutes && toMin(b.at_time) + b.minutes > m);
      const free = over.length < team && !(staff && over.some((b) => b.staff === staff));
      out.push({ t: toTime(m), free });
    }
    return out;
  }, [svc, busy, staff, team, appts.open, appts.close, day]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (service === null || !time) return setError("Choisissez une prestation et un créneau.");
    const f = new FormData(e.currentTarget);
    const body = { slug, service, staff, day, time, name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""), message: String(f.get("message") ?? "") };
    setError("");
    if (!slug || slug.startsWith("exemple-")) return setDone(`Ceci est un aperçu : une fois le site en ligne, ${brand} recevra ce rendez-vous.`);
    setSending(true);
    try {
      const res = await fetch("/api/rdv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Le rendez-vous n'est pas passé. Merci d'appeler.");
      const c = dayChip(day);
      setDone(`C'est noté, ${body.name.split(" ")[0]} ! ${svc?.name} le ${c.wd} ${c.n} ${c.m} à ${time.replace(":", "h")}${staff ? ` avec ${staff}` : ""}. À bientôt chez ${brand}.`);
      setTime("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le rendez-vous n'est pas passé.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;
  return (
    <div className="s-modal" role="dialog" aria-modal="true" aria-label="Prendre rendez-vous" onClick={() => setOpen(false)}>
      <div className="s-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="s-modal-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
        {done ? (
          <div className="s-modal-done">
            <p className="s-display s-modal-title">{done}</p>
            <button type="button" className="s-btn" onClick={() => { setOpen(false); setDone(""); }}>Fermer</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="s-eyebrow">Rendez-vous</p>
            <h2 className="s-display s-modal-title">Prendre rendez-vous</h2>
            <p className="s-order-cat">1 · La prestation</p>
            <div className="s-rdv-services">
              {appts.services.map((s, k) => (
                <button key={k} type="button" className={`s-rdv-svc${service === k ? " on" : ""}`} onClick={() => { setService(k); setTime(""); }}>
                  <span>{s.name}<small>{s.minutes} min</small></span>{s.price && <b>{s.price}</b>}
                </button>
              ))}
            </div>
            {appts.staff.length > 1 && (
              <>
                <p className="s-order-cat">2 · Avec qui ?</p>
                <div className="s-chips">
                  {["", ...appts.staff].map((p) => (
                    <button key={p || "any"} type="button" className={staff === p ? "on" : ""} onClick={() => { setStaff(p); setTime(""); }}>{p || "Sans préférence"}</button>
                  ))}
                </div>
              </>
            )}
            <p className="s-order-cat">{appts.staff.length > 1 ? "3" : "2"} · Le jour</p>
            <div className="s-days">
              {days.map((d) => {
                const c = dayChip(d);
                return (
                  <button key={d} type="button" className={day === d ? "on" : ""} onClick={() => { setDay(d); setTime(""); }}>
                    <small>{c.wd}</small><b>{c.n}</b><small>{c.m}</small>
                  </button>
                );
              })}
            </div>
            {svc && (
              <>
                <p className="s-order-cat">{appts.staff.length > 1 ? "4" : "3"} · L&apos;heure</p>
                {slots.some((s) => s.free) ? (
                  <div className="s-slots">
                    {slots.map((s) => (
                      <button key={s.t} type="button" disabled={!s.free} className={time === s.t ? "on" : ""} onClick={() => setTime(s.t)}>{s.t.replace(":", "h")}</button>
                    ))}
                  </div>
                ) : <p className="s-modal-note">Plus de créneau libre ce jour-là. Choisissez un autre jour.</p>}
              </>
            )}
            {time && (
              <>
                <div className="s-field-row">
                  <label className="s-field"><span>Nom</span><input name="name" autoComplete="name" required maxLength={80} /></label>
                  <label className="s-field"><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" required minLength={6} maxLength={30} /></label>
                </div>
                <label className="s-field"><span>Message <em>(facultatif)</em></span><textarea name="message" rows={2} maxLength={300} /></label>
              </>
            )}
            {error && <p className="s-modal-error" role="alert">{error}</p>}
            <button className="s-btn s-btn-full" disabled={sending || !time}>
              {sending ? "Envoi…" : time && svc ? `Réserver · ${svc.name} à ${time.replace(":", "h")}` : "Choisissez votre créneau"}
            </button>
            <p className="s-modal-note">Gratuit et sans engagement. En cas d&apos;empêchement, merci de prévenir.</p>
          </form>
        )}
      </div>
    </div>
  );
}
