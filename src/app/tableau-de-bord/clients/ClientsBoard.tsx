"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Application = { id: string; site: string; job: string; name: string; phone: string; email: string; message: string; cv: string; seen: boolean; created_at: string };
export type Subscriber = { id: string; site: string; contact: string; kind: "email" | "sms"; created_at: string };

const dayLabel = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
const first = (n: string) => n.trim().split(/\s+/)[0];

export function ClientsBoard({ applications, subscribers, multiSite }: { applications: Application[]; subscribers: Subscriber[]; multiSite: boolean }) {
  const [tab, setTab] = useState<"cand" | "subs">(applications.length || !subscribers.length ? "cand" : "subs");
  const [apps, setApps] = useState(applications);
  const [subs, setSubs] = useState(subscribers);
  const supabase = createClient();

  async function openCv(path: string) {
    const { data } = await supabase.storage.from("cv").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  async function remove(id: string) {
    await supabase.from("job_applications").delete().eq("id", id);
    setApps((l) => l.filter((a) => a.id !== id));
  }
  async function seen(id: string) {
    await supabase.from("job_applications").update({ seen: true }).eq("id", id);
    setApps((l) => l.map((a) => (a.id === id ? { ...a, seen: true } : a)));
  }
  async function unsub(id: string) {
    await supabase.from("subscribers").delete().eq("id", id);
    setSubs((l) => l.filter((s) => s.id !== id));
  }

  return (
    <div className="mt-8">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("cand")} className={`rounded-full px-4 py-2 text-sm ${tab === "cand" ? "bg-ink text-cream" : "border border-line"}`}>Candidatures ({apps.length})</button>
        <button type="button" onClick={() => setTab("subs")} className={`rounded-full px-4 py-2 text-sm ${tab === "subs" ? "bg-ink text-cream" : "border border-line"}`}>Inscrits ({subs.length})</button>
      </div>
      {tab === "cand" ? (
        <ul className="mt-5 space-y-3">
          {!apps.length && <li className="rounded-3xl border border-line bg-card p-5 text-sm text-muted">Aucune candidature pour l&apos;instant. Publiez une annonce dans « Modifier moi-même » → Offres d&apos;emploi.</li>}
          {apps.map((a) => (
            <li key={a.id} className={`rounded-3xl border bg-card p-5 ${a.seen ? "border-line" : "border-clic/50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold">{a.name}</p>
                  <p className="text-sm text-muted">{a.job || "Candidature spontanée"}{multiSite && a.site ? ` · ${a.site}` : ""} · {dayLabel(a.created_at)}</p>
                </div>
                {!a.seen && <span className="shrink-0 rounded-full bg-clic/15 px-2.5 py-1 text-xs font-medium text-clic">Nouveau</span>}
              </div>
              {a.message && <p className="mt-3 whitespace-pre-line rounded-2xl bg-white/5 px-3 py-2 text-sm text-ink/80">{a.message}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {a.phone && <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} onClick={() => seen(a.id)} className="rounded-full bg-clic px-4 py-2 text-sm font-medium text-white">Appeler · {a.phone}</a>}
                {a.phone && <a href={`sms:${a.phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(`Bonjour ${first(a.name)}, merci pour votre candidature${a.site ? ` chez ${a.site}` : ""}. Seriez-vous disponible pour un entretien ?`)}`} onClick={() => seen(a.id)} className="rounded-full border border-line px-4 py-2 text-sm">SMS entretien</a>}
                {a.email && <a href={`mailto:${a.email}`} onClick={() => seen(a.id)} className="rounded-full border border-line px-4 py-2 text-sm">E-mail</a>}
                {a.cv && <button type="button" onClick={() => { void openCv(a.cv); void seen(a.id); }} className="rounded-full border border-line px-4 py-2 text-sm">📎 Voir le CV</button>}
                <button type="button" onClick={() => remove(a.id)} className="px-2 py-2 text-sm text-muted underline underline-offset-4">Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-3xl border border-line bg-card">
          {!subs.length && <li className="p-5 text-sm text-muted">Aucun inscrit pour l&apos;instant. Activez l&apos;encadré « Restez informé » dans « Modifier moi-même » → Newsletter.</li>}
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{s.kind === "sms" ? "💬" : "✉️"} {s.contact}</p>
                <p className="text-[11px] text-muted">{dayLabel(s.created_at)}{multiSite && s.site ? ` · ${s.site}` : ""}</p>
              </div>
              <button type="button" onClick={() => unsub(s.id)} className="shrink-0 text-xs text-muted underline underline-offset-4">Désinscrire</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
