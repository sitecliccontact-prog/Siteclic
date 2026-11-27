"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OPTIONS, type OptionId } from "@/lib/pricing";
import { ALLERGENS, type SiteContent } from "@/lib/site/schema";

/* Options en plus : événements, offres d'emploi, newsletter / SMS, allergènes par l'IA, nom de domaine. */

type Save = (body: object, ok: string) => Promise<void>;
type P = { id: string; content: SiteContent; busy: boolean; save: Save; team: boolean };

const input = "w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[15px] outline-none focus:border-ink/60";
const primary = "w-full rounded-full bg-clic py-2.5 text-sm font-medium text-white disabled:opacity-40";
const ghost = "rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40";
const parisDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const TEAM = /^siteclic\.contact(\+[^@]*)?@gmail\.com$/i;

export function OptionsPanel(p: Omit<P, "team">) {
  const [team, setTeam] = useState(false);
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setTeam(TEAM.test(data.user?.email ?? ""))).catch(() => {});
  }, []);
  const q = { ...p, team };
  return (
    <>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">Options en plus</p>
      <EventsCard {...q} />
      <AllergensCard {...q} />
      <NewsletterCard {...q} />
      <JobsCard {...q} />
      <DomainCard {...q} />
    </>
  );
}

function Badge({ id, team }: { id: OptionId; team: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${team ? "bg-emerald-400/10 text-emerald-300" : "bg-clic/15 text-clic"}`}>
      {team ? "Inclus" : `Option · ${OPTIONS[id].price}`}
    </span>
  );
}

function Card({ title, text, option, team, children, hot }: { title: string; text?: string; option: OptionId; team: boolean; children?: React.ReactNode; hot?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 ${hot ? "border-clic/50" : "border-line"}`}>
      <Badge id={option} team={team} />
      <p className="mt-2 font-medium">{title}</p>
      {text && <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>}
      {children}
    </div>
  );
}

function Toggle({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-clic" : "bg-white/15"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

/* ---------- Événements et soirées ---------- */

type Ev = NonNullable<SiteContent["events"]>[number];
const newEvent = (): Ev => ({ id: Math.random().toString(36).slice(2, 8), title: "", date: parisDay(), time: "20:00", description: "", price: "", seats: 40 });

function EventsCard({ content, busy, save, team }: P) {
  const [list, setList] = useState<Ev[]>((content.events ?? []).filter((e) => e.date >= parisDay()));
  const set = (k: number, patch: Partial<Ev>) => setList((l) => l.map((e, i) => (i === k ? { ...e, ...patch } : e)));
  const valid = list.filter((e) => e.title.trim());
  return (
    <Card option="evenements" team={team} hot={valid.length > 0} title="Événements et soirées"
      text="Soirée jazz, dégustation, atelier, brunch du dimanche… Vos clients réservent leur place sur le site. Quand c'est plein, c'est affiché « Complet » tout seul.">
      <div className="mt-3 space-y-3">
        {list.map((e, k) => (
          <div key={e.id} className="space-y-2 rounded-xl border border-line p-3">
            <input value={e.title} onChange={(x) => set(k, { title: x.target.value })} maxLength={80} placeholder="Ex. Soirée jazz & tapas" className={input} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={e.date} min={parisDay()} onChange={(x) => set(k, { date: x.target.value })} className={input} aria-label="Date" />
              <input type="time" value={e.time} onChange={(x) => set(k, { time: x.target.value })} className={input} aria-label="Heure" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={e.price} onChange={(x) => set(k, { price: x.target.value })} maxLength={20} placeholder="Prix (ex. 35 €)" className={input} />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="number" min={0} max={2000} value={e.seats} onChange={(x) => set(k, { seats: Math.max(0, Math.min(2000, Number(x.target.value) || 0)) })} className={input} aria-label="Nombre de places" />
                places
              </label>
            </div>
            <textarea value={e.description} onChange={(x) => set(k, { description: x.target.value })} maxLength={400} rows={2} placeholder="En deux mots : le programme, le menu…" className={input} />
            <button type="button" onClick={() => setList((l) => l.filter((_, i) => i !== k))} className="text-xs text-muted underline underline-offset-4">Retirer cet événement</button>
          </div>
        ))}
      </div>
      {list.length < 12 && <button type="button" onClick={() => setList((l) => [...l, newEvent()])} className={`${ghost} mt-3`}>+ Ajouter un événement</button>}
      <button type="button" disabled={busy} onClick={() => save({ events: valid.map((e) => ({ ...e, title: e.title.trim() })) }, valid.length ? "Événements en ligne ✓" : "Événements retirés.")} className={`${primary} mt-3`}>
        Enregistrer les événements
      </button>
      <p className="mt-2 text-[11px] text-muted">0 place = sans limite. Les réservations arrivent dans « Réservations ».</p>
    </Card>
  );
}

/* ---------- Allergènes par l'IA ---------- */

function AllergensCard({ id, content, busy, save, team }: P) {
  const [map, setMap] = useState<Record<string, string[]>>(content.allergens ?? {});
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  const dishes = content.offer.categories.flatMap((c) => c.items.map((i) => i.name));
  if (!dishes.length) return null;
  async function ai() {
    setWorking(true);
    setMsg("");
    const res = await fetch(`/api/sites/${id}/allergenes`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.allergens) { setMap(d.allergens); setMsg("Vérifiez, corrigez si besoin, puis enregistrez."); }
    else setMsg(d?.error || "L'IA n'a pas pu lire la carte. Réessayez.");
    setWorking(false);
  }
  const toggle = (dish: string, a: string) => setMap((m) => {
    const cur = m[dish] ?? [];
    const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
    return { ...m, [dish]: next };
  });
  const done = Object.values(map).some((v) => v.length);
  return (
    <Card option="allergenes" team={team} hot={Boolean(content.allergens && Object.keys(content.allergens).length)} title="Allergènes sur la carte"
      text="L'IA lit chaque plat et indique ses allergènes (les 14 allergènes officiels). Ils s'affichent sous chaque plat. C'est obligatoire en restauration : vous vérifiez avant d'enregistrer.">
      <button type="button" disabled={busy || working} onClick={ai} className={`${primary} mt-3`}>{working ? "L'IA lit votre carte…" : done ? "Relancer l'IA" : "L'IA ajoute les allergènes"}</button>
      {msg && <p className="mt-2 text-xs text-ink/80">{msg}</p>}
      {done && (
        <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {dishes.map((d) => (
            <div key={d}>
              <p className="text-sm font-medium">{d}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {ALLERGENS.map((a) => {
                  const on = map[d]?.includes(a);
                  return <button key={a} type="button" onClick={() => toggle(d, a)} className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-clic text-white" : "border border-line text-muted"}`}>{a}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {done && (
        <button type="button" disabled={busy} onClick={() => save({ allergens: Object.fromEntries(Object.entries(map).filter(([k, v]) => v.length && dishes.includes(k))) }, "Allergènes affichés sur la carte ✓")} className={`${primary} mt-3`}>
          Enregistrer les allergènes
        </button>
      )}
    </Card>
  );
}

/* ---------- Newsletter / SMS ---------- */

type Sub = { contact: string; kind: "email" | "sms" };
type Msg = { subject: string; email: string; sms: string };

function NewsletterCard({ id, content, busy, save, team }: P) {
  const on = content.newsletter?.enabled ?? false;
  const [perk, setPerk] = useState(content.newsletter?.perk ?? "");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [topic, setTopic] = useState("");
  const [msg, setMsg] = useState<Msg | null>(null);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    createClient().from("subscribers").select("contact, kind").eq("site_id", id).order("created_at", { ascending: false }).limit(2000)
      .then(({ data }) => setSubs((data ?? []) as Sub[]));
  }, [id]);
  const emails = subs.filter((s) => s.kind === "email").map((s) => s.contact);
  const phones = subs.filter((s) => s.kind === "sms").map((s) => s.contact);
  const chunks = (l: string[], n: number) => Array.from({ length: Math.ceil(l.length / n) }, (_, k) => l.slice(k * n, k * n + n));

  async function write() {
    setWorking(true);
    setErr("");
    const res = await fetch(`/api/sites/${id}/newsletter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.sms) setMsg(d); else setErr(d?.error || "L'IA n'a pas pu écrire le message.");
    setWorking(false);
  }

  return (
    <Card option="newsletter" team={team} hot={on} title="Newsletter et SMS aux clients"
      text="Un encadré « Restez informé » sur votre site : vos clients laissent leur e-mail ou leur téléphone. Ensuite, dites à l'IA ce que vous voulez annoncer, elle écrit le message.">
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm">{on ? "Encadré affiché sur le site" : "Afficher l'encadré sur le site"}</span>
        <Toggle on={on} label="Newsletter" disabled={busy} onClick={() => save({ newsletter: { enabled: !on, perk: perk.trim() } }, on ? "Encadré retiré." : "Encadré « Restez informé » en ligne ✓")} />
      </div>
      <input value={perk} onChange={(e) => setPerk(e.target.value)} onBlur={() => on && perk.trim() !== (content.newsletter?.perk ?? "") && save({ newsletter: { enabled: on, perk: perk.trim() } }, "Cadeau d'inscription enregistré ✓")}
        maxLength={100} placeholder="Petit cadeau d'inscription ? Ex. Un café offert à votre prochaine visite" className={`${input} mt-2`} />
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-white/5 p-2"><p className="font-display text-2xl font-semibold">{emails.length}</p><p className="text-[11px] text-muted">e-mails</p></div>
        <div className="rounded-xl bg-white/5 p-2"><p className="font-display text-2xl font-semibold">{phones.length}</p><p className="text-[11px] text-muted">téléphones</p></div>
      </div>
      <textarea value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={400} rows={2} placeholder="Que voulez-vous annoncer ? Ex. soirée truffe vendredi 12, menu à 45 €" className={`${input} mt-3`} />
      <button type="button" disabled={busy || working || topic.trim().length < 3} onClick={write} className={`${primary} mt-2`}>{working ? "L'IA écrit…" : msg ? "Réécrire le message" : "L'IA écrit le message"}</button>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      {msg && (
        <div className="mt-3 space-y-2">
          <input value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} className={input} aria-label="Objet" />
          <textarea value={msg.email} onChange={(e) => setMsg({ ...msg, email: e.target.value })} rows={5} className={input} aria-label="E-mail" />
          <textarea value={msg.sms} onChange={(e) => setMsg({ ...msg, sms: e.target.value })} rows={3} className={input} aria-label="SMS" />
          <p className="text-[11px] text-muted">SMS : {msg.sms.length} caractères</p>
          <div className="flex flex-wrap gap-2">
            {chunks(emails, 40).map((c, k, all) => (
              <a key={`e${k}`} href={`mailto:?bcc=${c.join(",")}&subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.email)}`} className="rounded-full bg-clic px-4 py-2 text-sm font-medium text-white">
                ✉️ Envoyer les e-mails{all.length > 1 ? ` (${k + 1}/${all.length})` : ""}
              </a>
            ))}
            {chunks(phones, 20).map((c, k, all) => (
              <a key={`s${k}`} href={`sms:${c.join(",")}?body=${encodeURIComponent(msg.sms)}`} className="rounded-full bg-clic px-4 py-2 text-sm font-medium text-white">
                💬 Envoyer les SMS{all.length > 1 ? ` (${k + 1}/${all.length})` : ""}
              </a>
            ))}
            <button type="button" onClick={() => navigator.clipboard.writeText(`${msg.subject}\n\n${msg.email}`)} className={ghost}>Copier</button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">Les boutons ouvrent votre messagerie avec tous vos inscrits en copie cachée et le texte prêt : vous n&apos;avez plus qu&apos;à appuyer sur Envoyer.</p>
        </div>
      )}
    </Card>
  );
}

/* ---------- Offres d'emploi ---------- */

type Job = NonNullable<SiteContent["jobs"]>["items"][number];
const KINDS = ["CDI", "CDD", "Extra", "Saisonnier", "Apprentissage", "Stage"];

function JobsCard({ content, busy, save, team }: P) {
  const on = content.jobs?.enabled ?? false;
  const [items, setItems] = useState<Job[]>(content.jobs?.items.length ? content.jobs.items : [{ title: "", kind: "CDI", text: "" }]);
  const set = (k: number, patch: Partial<Job>) => setItems((l) => l.map((j, i) => (i === k ? { ...j, ...patch } : j)));
  const valid = items.filter((j) => j.title.trim()).map((j) => ({ title: j.title.trim(), kind: j.kind, text: j.text.trim() }));
  return (
    <Card option="emploi" team={team} hot={on} title="Offres d'emploi"
      text="Un bandeau « On recrute » en haut du site et vos annonces. Les candidats postulent en un geste, avec leur CV s'ils veulent. Vous les retrouvez dans « Inscrits et candidatures ».">
      <div className="mt-3 space-y-3">
        {items.map((j, k) => (
          <div key={k} className="space-y-2 rounded-xl border border-line p-3">
            <input value={j.title} onChange={(e) => set(k, { title: e.target.value })} maxLength={60} placeholder="Poste (ex. Serveur / Serveuse)" className={input} />
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((t) => <button key={t} type="button" onClick={() => set(k, { kind: t })} className={`rounded-full px-3 py-1 text-xs ${j.kind === t ? "bg-clic text-white" : "border border-line text-muted"}`}>{t}</button>)}
            </div>
            <textarea value={j.text} onChange={(e) => set(k, { text: e.target.value })} maxLength={500} rows={2} placeholder="Horaires, expérience, salaire… (facultatif)" className={input} />
            {items.length > 1 && <button type="button" onClick={() => setItems((l) => l.filter((_, i) => i !== k))} className="text-xs text-muted underline underline-offset-4">Retirer</button>}
          </div>
        ))}
      </div>
      {items.length < 6 && <button type="button" onClick={() => setItems((l) => [...l, { title: "", kind: "CDI", text: "" }])} className={`${ghost} mt-3`}>+ Ajouter un poste</button>}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={busy || !valid.length} onClick={() => save({ jobs: { enabled: true, items: valid } }, "Annonces en ligne ✓")} className={primary}>
          {on ? "Mettre à jour les annonces" : "Publier les annonces"}
        </button>
        {on && <button type="button" disabled={busy} onClick={() => save({ jobs: { enabled: false, items: valid } }, "Recrutement fermé.")} className="shrink-0 text-sm text-muted underline underline-offset-4">Fermer</button>}
      </div>
    </Card>
  );
}

/* ---------- Nom de domaine ---------- */

function DomainCard({ id, content, team }: P) {
  const [req, setReq] = useState<{ domain: string; status: string } | null>(null);
  const guess = content.brand.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const [domain, setDomain] = useState(guess ? `${guess}.fr` : "");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/sites/${id}/domaine`).then((r) => r.json()).then((d) => d.request && setReq(d.request)).catch(() => {});
  }, [id]);
  async function send() {
    setWorking(true);
    setErr("");
    const res = await fetch(`/api/sites/${id}/domaine`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d?.request) setReq(d.request); else setErr(d?.error || "Demande impossible.");
    setWorking(false);
  }
  return (
    <Card option="domaine" team={team} hot={req?.status === "actif"} title="Votre propre adresse (nom de domaine)"
      text="Votre site sur votre adresse à vous, par exemple belati-bandol.fr au lieu de siteclic.vercel.app/s/… On s'occupe de tout : achat, branchement, renouvellement.">
      {req?.status === "actif" ? (
        <p className="mt-3 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">✓ Votre site est en ligne sur <a href={`https://${req.domain}`} target="_blank" rel="noreferrer" className="underline">{req.domain}</a></p>
      ) : req?.status === "demande" ? (
        <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm">⏳ Demande reçue pour <b>{req.domain}</b>. Elle sera active sous 48 h, on vous prévient.</p>
      ) : req?.status === "refuse" ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">« {req.domain} » n&apos;est pas disponible. Essayez une autre adresse.</p>
      ) : null}
      {req?.status !== "actif" && (
        <>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={120} placeholder="monresto.fr" className={`${input} mt-3`} inputMode="url" autoCapitalize="none" />
          <button type="button" disabled={working || domain.trim().length < 4} onClick={send} className={`${primary} mt-2`}>{working ? "Envoi…" : req ? "Changer ma demande" : "Je veux cette adresse"}</button>
          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        </>
      )}
    </Card>
  );
}
