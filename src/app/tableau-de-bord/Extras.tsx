"use client";

import { friendlyError } from "@/lib/errors";
import { useEffect, useState } from "react";

/* Tableau de bord : notifications sur le téléphone, parrainage. */

const card = "rounded-3xl border border-line bg-card/80 p-5 backdrop-blur";
const btn = "rounded-full bg-clic px-4 py-2 text-sm font-medium text-white disabled:opacity-40";

function b64ToBytes(b64: string) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function NotifyCard() {
  const [state, setState] = useState<"?" | "off" | "on" | "refuse" | "impossible">("?");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("impossible");
      if (Notification.permission === "denied") return setState("refuse");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("off"));
  }, []);

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "refuse" : "off"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const { publicKey, error } = await fetch("/api/notifications").then((r) => r.json());
      if (!publicKey) throw new Error(error || "Notifications indisponibles.");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
      const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Activation impossible.");
      setState("on");
      setMsg("C'est activé : une notification d'essai vient d'arriver.");
    } catch (e) {
      setMsg(friendlyError(e, "Activation impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch(`/api/notifications?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" }).catch(() => null);
      await sub.unsubscribe().catch(() => null);
    }
    setState("off");
    setBusy(false);
  }

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">🔔 Notifications sur ce téléphone</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">Votre téléphone sonne à chaque réservation, rendez-vous, commande ou candidature. Et chaque lundi matin, le résumé de votre semaine.</p>
        </div>
        {state === "on" && <span className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Activées</span>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {state === "off" && <button type="button" disabled={busy} onClick={enable} className={btn}>{busy ? "Activation…" : "Activer les notifications"}</button>}
        {state === "on" && <button type="button" disabled={busy} onClick={disable} className="text-sm text-muted underline underline-offset-4">Désactiver sur ce téléphone</button>}
        {state === "refuse" && <p className="text-sm text-muted">Les notifications sont bloquées. Ouvrez les réglages du navigateur (cadenas à côté de l&apos;adresse) → Notifications → Autoriser.</p>}
        {state === "impossible" && <p className="text-sm text-muted">Ce navigateur ne les accepte pas. Sur iPhone : ajoutez d&apos;abord SiteClic à l&apos;écran d&apos;accueil (Partager → « Sur l&apos;écran d&apos;accueil »).</p>}
      </div>
      {msg && <p className="mt-3 text-sm text-ink/80" role="status">{msg}</p>}
    </div>
  );
}

type Ref = { code: string; joined: number; active: number };

export function ReferralCard() {
  const [ref, setRef] = useState<Ref | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    (async () => {
      // Inscrit avec le lien d'un parrain : on l'enregistre une fois.
      let code = "";
      try { code = localStorage.getItem("sc_parrain") ?? ""; } catch {}
      if (code) {
        await fetch("/api/parrainage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
        try { localStorage.removeItem("sc_parrain"); } catch {}
      }
      const d = await fetch("/api/parrainage").then((r) => r.json());
      if (d.code) setRef(d);
    })().catch(() => {});
  }, []);
  if (!ref) return null;
  const link = `${window.location.origin}/inscription?parrain=${ref.code}`;
  const text = `J'ai fait le site de mon commerce avec SiteClic, en quelques minutes et sans rien y connaître. Essaie avec mon lien : ${link}`;
  return (
    <div className={card}>
      <p className="font-medium">🎁 Parrainage : 1 mois offert</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">Un commerçant s&apos;inscrit avec votre lien et met son site en ligne : vous gagnez 1 mois d&apos;hébergement. Sans limite.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white/5 p-3"><p className="font-display text-2xl font-semibold tracking-widest">{ref.code}</p><p className="text-[11px] text-muted">votre code</p></div>
        <div className="rounded-2xl bg-white/5 p-3"><p className="font-display text-2xl font-semibold">{ref.joined}</p><p className="text-[11px] text-muted">inscrits</p></div>
        <div className="rounded-2xl bg-white/5 p-3"><p className="font-display text-2xl font-semibold text-clic">{ref.active}</p><p className="text-[11px] text-muted">mois gagnés</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`sms:?body=${encodeURIComponent(text)}`} className={btn}>Envoyer par SMS</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 text-sm">WhatsApp</a>
        <button type="button" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))} className="rounded-full border border-line px-4 py-2 text-sm">{copied ? "Lien copié ✓" : "Copier le lien"}</button>
      </div>
    </div>
  );
}
