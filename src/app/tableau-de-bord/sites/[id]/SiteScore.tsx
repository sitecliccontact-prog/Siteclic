"use client";

import { bookingEnabled, faqItems, type SiteContent } from "@/lib/site/schema";

/* « Mon site est-il complet ? » : un score simple et les prochains petits gestes qui rapportent le plus. */

type Check = { ok: boolean; label: string; tip: string };

export function checks(c: SiteContent, online: boolean): Check[] {
  const actions = bookingEnabled(c) || c.appointments?.enabled || c.order?.enabled || c.shop?.enabled;
  return [
    { ok: c.photos.length > 0, label: "Photo de fond", tip: "Ajoutez une belle photo de votre commerce (bloc « Photos »)." },
    { ok: c.photos.length >= 4, label: "4 photos ou plus", tip: "Les sites avec plusieurs photos donnent bien plus envie (bloc « Photos »)." },
    { ok: c.hours.length > 0, label: "Horaires", tip: "Indiquez vos horaires : votre site affichera « Ouvert maintenant » (bloc « Horaires »)." },
    { ok: Boolean(c.contact.phone.trim()), label: "Téléphone", tip: "Ajoutez votre numéro : un bouton « Appeler » apparaît sur téléphone (bloc « Contact »)." },
    { ok: Boolean(c.contact.address.trim()), label: "Adresse", tip: "Ajoutez votre adresse : le plan et l'itinéraire s'affichent (bloc « Contact »)." },
    { ok: Boolean(c.links?.instagram || c.links?.facebook || c.links?.whatsapp), label: "Réseaux sociaux", tip: "Ajoutez Instagram, Facebook ou WhatsApp (bloc « Contact »)." },
    { ok: Boolean(actions), label: "Réserver ou commander", tip: "Activez la réservation, les rendez-vous ou la commande en ligne (en haut de « Modifier moi-même »)." },
    { ok: Boolean(c.reviews?.items.length || c.reviews?.googleUrl), label: "Avis clients", tip: "Recopiez 2 ou 3 avis Google : ils rassurent les nouveaux clients." },
    { ok: faqItems(c).length >= 2, label: "Questions fréquentes", tip: "Répondez à 2 questions que vos clients posent souvent (bloc « Questions fréquentes »)." },
    { ok: online, label: "En ligne", tip: "Touchez « Mettre en ligne » en haut de l'écran." },
  ];
}

export function SiteScore({ content, online }: { content: SiteContent; online: boolean }) {
  const list = checks(content, online);
  const done = list.filter((x) => x.ok).length;
  const pct = Math.round((done / list.length) * 100);
  const todo = list.filter((x) => !x.ok).slice(0, 3);
  const r = 22, len = 2 * Math.PI * r;
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      {/* pr : laisse la place au bouton « ? » de l'aide sur téléphone */}
      <div className="flex items-center gap-4 pr-12 lg:pr-0">
        <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" style={{ stroke: "var(--line)" }} />
          <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)}
            style={{ stroke: pct === 100 ? "#34d399" : "var(--clic)", transition: "stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)" }} />
        </svg>
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold leading-none">{pct} %</p>
          <p className="mt-1 text-sm text-muted">{pct === 100 ? "Bravo, votre site est complet." : "Votre site est presque prêt à séduire."}</p>
        </div>
      </div>
      {todo.length > 0 && (
        <ul className="mt-4 space-y-2">
          {todo.map((x) => (
            <li key={x.label} className="flex gap-2.5 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-clic" aria-hidden />
              <span><span className="font-medium">{x.label}</span><span className="text-muted"> · {x.tip}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
