"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PublishButton, type PublishState } from "@/components/PublishButton";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import type { SiteContent, ThemeName } from "@/lib/site/schema";

type Tab = "ia" | "main" | "apercu";
type Msg = { from: "moi" | "ia"; text: string; subscribe?: boolean };
type SaveState = "ok" | "saving" | "error";

const SUGGESTIONS = [
  "On ferme à 19h le samedi",
  "Ajoute un plat du jour à 14 €",
  "Rends les textes plus courts",
  "Passe à un style plus moderne",
];

const THEME_LABELS: { id: ThemeName; label: string; colors: [string, string] }[] = [
  { id: "bistrot", label: "Bistrot", colors: ["#13261f", "#c9a45c"] },
  { id: "atelier", label: "Atelier", colors: ["#ffffff", "#e63312"] },
  { id: "terracotta", label: "Terracotta", colors: ["#f5ece0", "#bf5b2c"] },
  { id: "minuit", label: "Minuit", colors: ["#0d1322", "#c8a96a"] },
  { id: "jardin", label: "Jardin", colors: ["#eef0e7", "#5f7f63"] },
];

export function Editor({ id, initial, publish }: { id: string; initial: SiteContent; publish: PublishState }) {
  const [content, setContent] = useState<SiteContent>(initial);
  const [history, setHistory] = useState<SiteContent[]>([]);
  const [tab, setTab] = useState<Tab>("ia");
  const [save, setSave] = useState<SaveState>("ok");
  const [changed, setChanged] = useState(publish.hasChanges);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = useRef<SiteContent | null>(null);

  async function saveNow(next: SiteContent) {
    const res = await fetch(`/api/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: next }),
    }).catch(() => null);
    if (unsaved.current === next) unsaved.current = null;
    setSave(res?.ok ? "ok" : "error");
  }

  // Enregistrement automatique, une seconde après la dernière modification à la main.
  function queueSave(next: SiteContent) {
    if (pending.current) clearTimeout(pending.current);
    setSave("saving");
    setChanged(true);
    unsaved.current = next;
    pending.current = setTimeout(() => saveNow(next), 1000);
  }

  // Avant de publier : on enregistre tout de suite la dernière frappe.
  async function flush() {
    if (pending.current) clearTimeout(pending.current);
    if (unsaved.current) await saveNow(unsaved.current);
  }

  function edit(fn: (draft: SiteContent) => void) {
    const next = structuredClone(content);
    fn(next);
    setContent(next);
    queueSave(next);
  }

  // Garde une version pour « Annuler » (une seule par série de frappes rapprochées).
  const lastSnapshot = useRef(0);
  function remember(force = false) {
    const now = Date.now();
    if (!force && now - lastSnapshot.current < 3000) return;
    lastSnapshot.current = now;
    setHistory((h) => [...h.slice(-19), content]);
  }

  function undo() {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setContent(prev);
    queueSave(prev);
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* Barre du haut */}
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/tableau-de-bord" className="shrink-0 whitespace-nowrap text-sm text-muted hover:text-ink">← Mes sites</Link>
        <p className="min-w-0 flex-1 truncate text-center font-display font-bold">{content.brand.name}</p>
        <span className="hidden text-xs text-muted sm:inline">
          {save === "saving" ? "Enregistrement…" : save === "error" ? "Non enregistré" : "Enregistré ✓"}
        </span>
        <button onClick={undo} disabled={!history.length}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-medium disabled:opacity-30">
          Annuler
        </button>
        <Link href={`/apercu/${id}`} className="hidden rounded-full border border-line px-3 py-1.5 text-xs font-medium sm:inline-block">Aperçu</Link>
        <PublishButton id={id} initial={{ ...publish, hasChanges: changed }}
          beforePublish={flush} onPublished={() => setChanged(false)} compact />
      </header>

      {/* Onglets (téléphone) */}
      <nav className="grid grid-cols-3 border-b border-line text-sm lg:hidden">
        {([["ia", "Écrire à l'IA"], ["main", "Modifier moi-même"], ["apercu", "Voir"]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 font-medium transition ${tab === t ? "border-b-2 border-clic text-ink" : "text-muted"}`}>
            {l}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1">
        {/* Panneau d'édition */}
        <aside className={`${tab === "apercu" ? "hidden" : "flex"} w-full flex-col border-line lg:flex lg:w-[440px] lg:shrink-0 lg:border-r`}>
          <div className="hidden border-b border-line lg:grid lg:grid-cols-2">
            {([["ia", "Écrire à l'IA"], ["main", "Modifier moi-même"]] as [Tab, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`py-3 text-sm font-medium ${tab === t || (t === "ia" && tab === "apercu") ? "border-b-2 border-clic" : "text-muted"}`}>
                {l}
              </button>
            ))}
          </div>
          {tab === "main" ? (
            <ManualPanel content={content} edit={(fn) => { remember(); edit(fn); }} />
          ) : (
            <AiPanel id={id} onResult={(c) => { remember(true); setContent(c); setChanged(true); }} />
          )}
        </aside>

        {/* Aperçu en direct */}
        <section className={`${tab === "apercu" ? "block" : "hidden"} min-w-0 flex-1 overflow-y-auto bg-sand lg:block`}>
          <div className="lg:p-6">
            <div className="overflow-hidden lg:rounded-2xl lg:border lg:border-line lg:shadow-2xl">
              <SiteRenderer content={content} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- Écrire à l'IA ---------- */

function AiPanel({ id, onResult }: { id: string; onResult: (c: SiteContent) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "ia", text: "Bonjour ! Dites-moi ce que vous voulez changer sur votre site, comme dans un message. Par exemple : « On ferme à 19h le samedi »." },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function send(instruction: string) {
    if (!instruction.trim() || busy) return;
    setMsgs((m) => [...m, { from: "moi", text: instruction }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch(`/api/sites/${id}/ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setMsgs((m) => [...m, { from: "ia", subscribe: true, text: "Les modifications par l'IA sont incluses dans l'abonnement SiteClic. Vous pouvez aussi modifier vos textes vous-même, gratuitement." }]);
        return;
      }
      if (!res.ok) throw new Error(data.error || "La modification a échoué.");
      onResult(data.content);
      setMsgs((m) => [...m, { from: "ia", text: data.reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "ia", text: e instanceof Error ? e.message : "La modification a échoué." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i}
            className={`w-fit max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.from === "moi" ? "ml-auto rounded-br-md bg-clic text-white" : "rounded-bl-md bg-card"}`}>
            {m.text}
            {m.subscribe && (
              <Link href={`/abonnement?retour=/tableau-de-bord/sites/${id}`}
                className="mt-3 block rounded-full bg-clic px-4 py-2 text-center text-sm font-medium text-white">
                Voir l&apos;abonnement
              </Link>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-card px-4 py-4">
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-ink/40 hover:text-ink">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Que voulez-vous changer ?"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            className="min-h-[52px] flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[15px] outline-none focus:border-ink/60" />
          <button disabled={busy || !text.trim()} aria-label="Envoyer"
            className="grid h-[52px] w-[52px] place-items-center rounded-full bg-clic text-xl text-white disabled:opacity-30">
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Modifier moi-même ---------- */

function ManualPanel({ content: c, edit }: { content: SiteContent; edit: (fn: (d: SiteContent) => void) => void }) {
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4 pb-16">
      <Block title="Style" open>
        <div className="grid grid-cols-5 gap-2">
          {THEME_LABELS.map((t) => (
            <button key={t.id} onClick={() => edit((d) => { d.theme = t.id; })} aria-pressed={c.theme === t.id}
              className={`rounded-xl border p-1.5 text-[11px] ${c.theme === t.id ? "border-clic" : "border-line"}`}>
              <span className="mb-1 flex h-8 overflow-hidden rounded-lg">
                <span className="flex-1" style={{ background: t.colors[0] }} />
                <span className="w-1/3" style={{ background: t.colors[1] }} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </Block>

      <Block title="Nom et accroche" open>
        <Field label="Nom du commerce" value={c.brand.name} onChange={(v) => edit((d) => { d.brand.name = v; })} />
        <Field label="Signature" value={c.brand.tagline} onChange={(v) => edit((d) => { d.brand.tagline = v; })} />
        <Field label="Petite ligne au-dessus du titre" value={c.hero.eyebrow} onChange={(v) => edit((d) => { d.hero.eyebrow = v; })} />
        <Field label="Grand titre" area value={c.hero.title} onChange={(v) => edit((d) => { d.hero.title = v; })} />
        <Field label="Texte d'accroche" area value={c.hero.subtitle} onChange={(v) => edit((d) => { d.hero.subtitle = v; })} />
        <Field label="Texte du bouton" value={c.hero.cta} onChange={(v) => edit((d) => { d.hero.cta = v; })} />
      </Block>

      <Block title="Photos">
        {c.photos.length === 0 ? (
          <p className="text-sm text-muted">Aucune photo pour l&apos;instant. L&apos;ajout de vos propres photos arrive bientôt.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {c.photos.map((src, i) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">En grand</span>}
                <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                  {i > 0 && (
                    <button title="Mettre en premier" onClick={() => edit((d) => { d.photos.splice(i, 1); d.photos.unshift(src); })}
                      className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">★</button>
                  )}
                  <button title="Retirer" onClick={() => edit((d) => { d.photos.splice(i, 1); })}
                    className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block title="Points forts">
        {c.highlights.map((h, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line p-3">
            <Field label={`Point fort ${i + 1}`} value={h.title} onChange={(v) => edit((d) => { d.highlights[i].title = v; })} />
            <Field label="Texte" area value={h.text} onChange={(v) => edit((d) => { d.highlights[i].text = v; })} />
          </div>
        ))}
      </Block>

      <Block title="Votre histoire">
        <Field label="Titre" value={c.about.title} onChange={(v) => edit((d) => { d.about.title = v; })} />
        {c.about.paragraphs.map((p, i) => (
          <Field key={i} label={`Paragraphe ${i + 1}`} area value={p} onChange={(v) => edit((d) => { d.about.paragraphs[i] = v; })} />
        ))}
      </Block>

      <Block title={c.offer.title || "Votre offre"}>
        <Field label="Titre de la section" value={c.offer.title} onChange={(v) => edit((d) => { d.offer.title = v; })} />
        <Field label="Introduction" area value={c.offer.intro} onChange={(v) => edit((d) => { d.offer.intro = v; })} />
        {c.offer.categories.map((cat, ci) => (
          <div key={ci} className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Catégorie" value={cat.name} onChange={(v) => edit((d) => { d.offer.categories[ci].name = v; })} />
              </div>
              <Remove onClick={() => edit((d) => { d.offer.categories.splice(ci, 1); })} />
            </div>
            {cat.items.map((it, ii) => (
              <div key={ii} className="rounded-lg bg-sand/60 p-2.5">
                <div className="flex gap-2">
                  <div className="flex-1"><Field label="Nom" value={it.name} onChange={(v) => edit((d) => { d.offer.categories[ci].items[ii].name = v; })} /></div>
                  <div className="w-24"><Field label="Prix" value={it.price} onChange={(v) => edit((d) => { d.offer.categories[ci].items[ii].price = v; })} /></div>
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1"><Field label="Description" value={it.description} onChange={(v) => edit((d) => { d.offer.categories[ci].items[ii].description = v; })} /></div>
                  <Remove onClick={() => edit((d) => { d.offer.categories[ci].items.splice(ii, 1); })} />
                </div>
              </div>
            ))}
            <Add onClick={() => edit((d) => { d.offer.categories[ci].items.push({ name: "Nouveau", description: "", price: "" }); })}>Ajouter une ligne</Add>
          </div>
        ))}
        <Add onClick={() => edit((d) => { d.offer.categories.push({ name: "Nouvelle catégorie", items: [] }); })}>Ajouter une catégorie</Add>
      </Block>

      <Block title="Horaires">
        {c.hours.map((h, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1"><Field label="Jours" value={h.days} onChange={(v) => edit((d) => { d.hours[i].days = v; })} /></div>
            <div className="flex-1"><Field label="Heures" value={h.time} onChange={(v) => edit((d) => { d.hours[i].time = v; })} /></div>
            <Remove onClick={() => edit((d) => { d.hours.splice(i, 1); })} />
          </div>
        ))}
        <Add onClick={() => edit((d) => { d.hours.push({ days: "", time: "" }); })}>Ajouter une ligne</Add>
      </Block>

      <Block title="Contact">
        <Field label="Adresse" value={c.contact.address} onChange={(v) => edit((d) => { d.contact.address = v; })} />
        <Field label="Téléphone" value={c.contact.phone} onChange={(v) => edit((d) => { d.contact.phone = v; })} />
        <Field label="E-mail" value={c.contact.email} onChange={(v) => edit((d) => { d.contact.email = v; })} />
      </Block>

      <Block title="Fin de page">
        <Field label="Titre" value={c.closing.title} onChange={(v) => edit((d) => { d.closing.title = v; })} />
        <Field label="Texte" area value={c.closing.text} onChange={(v) => edit((d) => { d.closing.text = v; })} />
      </Block>
    </div>
  );
}

function Block({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 font-medium">
        {title}
        <span className="text-clic transition group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-[15px] outline-none focus:border-ink/60";

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {area ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y leading-relaxed`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </label>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Supprimer" className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-red-400">
      ✕
    </button>
  );
}

function Add({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-dashed border-line py-2.5 text-sm text-muted hover:border-ink/40 hover:text-ink">
      + {children}
    </button>
  );
}
