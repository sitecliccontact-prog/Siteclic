"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/components/site/themes";
import { MOODS } from "@/lib/site/moods";
import { uploadVideo } from "@/lib/site/videos";

const TRADES = [
  "Restaurant", "Boulangerie", "Pâtisserie", "Café", "Coiffeur", "Barbier",
  "Institut de beauté", "Fleuriste", "Boutique", "Artisan", "Bar", "Autre",
];


const SERVICES = [
  "Sur place", "À emporter", "Livraison", "Terrasse", "Click & collect", "Sur réservation",
  "Accès handicapé", "Parking proche", "Wi-Fi", "Animaux acceptés", "Groupes et privatisation", "Traiteur et événements",
];
const PAYMENTS = ["Carte bancaire", "Sans contact", "Espèces", "Titres-restaurant", "Chèques"];

type Brief = {
  trade: string; name: string; city: string; address: string; phone: string; email: string;
  offer: string; hours: string; story: string; mood: string;
  specialties: string; services: string[]; payments: string[]; audience: string; since: string;
  languages: string; instagram: string; facebook: string;
  video: "non" | "auto" | "perso"; videoUrl: string; videoClips: string[];
};
type TextKey = Exclude<keyof Brief, "services" | "payments" | "video" | "videoClips">;

const EMPTY: Brief = {
  trade: "", name: "", city: "", address: "", phone: "", email: "", offer: "", hours: "", story: "", mood: "",
  specialties: "", services: [], payments: [], audience: "", since: "", languages: "", instagram: "", facebook: "",
  video: "auto", videoUrl: "", videoClips: [],
};

const STEPS = ["Votre métier", "Votre commerce", "Ce que vous proposez", "Plus de détails", "Horaires et contact", "Vidéo", "L'ambiance"];

const LOADING = [
  "Nous lisons vos réponses…",
  "Nous écrivons vos textes…",
  "Nous mettons en valeur vos produits…",
  "Nous choisissons les couleurs et la typographie…",
  "Nous mettons la dernière main à votre site…",
];

export function Wizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [b, setB] = useState<Brief>({ ...EMPTY, name: defaultName });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: TextKey) => (v: string) => setB((p) => ({ ...p, [k]: v }));
  const toggle = (k: "services" | "payments", v: string) =>
    setB((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  const canNext = [
    b.trade.trim().length > 0,
    b.name.trim().length > 0,
    b.offer.trim().length > 10,
    true,
    true,
    true,
    b.mood.length > 0,
  ][step];

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sites/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (res.status === 504 ? "L'IA a mis trop de temps à répondre. Réessayez. (code 504)" : "La création a échoué. Réessayez dans un instant. (code HTTP " + res.status + ")"));
      router.push(`/apercu/${data.id}?nouveau=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La création a échoué.");
      setLoading(false);
    }
  }

  if (loading) return <Generating mood={b.mood} />;

  return (
    <div className="mx-auto max-w-xl">
      {/* Progression */}
      <div className="mb-10 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div className={`wiz-fill absolute inset-0 origin-left rounded-full bg-clic ${i < step ? "is-done" : i === step ? "is-now" : ""}`} />
          </div>
        ))}
      </div>
      <p className="flex min-w-0 items-baseline gap-2 text-sm font-medium uppercase tracking-[0.16em] text-clic">
        <span key={step} className="wiz-count whitespace-nowrap">Étape {step + 1}</span>
        <span className="truncate text-muted">sur {STEPS.length} · {STEPS[step]}</span>
      </p>

      <div key={step} className="wiz-step">
        {step === 0 && (
          <Section title="Quel est votre métier ?">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {TRADES.map((t) => (
                <Choice key={t} active={b.trade === t} onClick={() => set("trade")(t)}>{t}</Choice>
              ))}
            </div>
          </Section>
        )}

        {step === 1 && (
          <Section title="Parlez-nous de votre commerce">
            <Input label="Nom du commerce" value={b.name} onChange={set("name")} placeholder="Ex. Le Petit Provençal" />
            <Input label="Ville" value={b.city} onChange={set("city")} placeholder="Ex. Aix-en-Provence" />
            <Area
              label="Votre histoire, ce qui vous rend différent"
              optional
              value={b.story}
              onChange={set("story")}
              placeholder="Ex. Restaurant familial depuis 1998, cuisine provençale faite maison avec les produits du marché…"
            />
          </Section>
        )}

        {step === 2 && (
          <Section title="Que proposez-vous ?" subtitle="Écrivez comme vous parlez. Ajoutez les prix si vous voulez qu'ils apparaissent.">
            <Area
              label="Vos produits ou services"
              rows={8}
              value={b.offer}
              onChange={set("offer")}
              placeholder={"Ex.\nMenu du midi 18 €\nDaube provençale 22 €\nTian de légumes 16 €\nTarte au citron 8 €\nVins de la région"}
            />
          </Section>
        )}

        {step === 3 && (
          <Section title="Quelques détails en plus" subtitle="Facultatif, mais plus vous en dites, plus votre site sera précis et convaincant. Vous pouvez aussi passer.">
            <Area label="Vos spécialités ou produits phares" optional rows={3} value={b.specialties} onChange={set("specialties")}
              placeholder="Ex. Notre fougasse aux olives, la tarte tropézienne maison, le pain au levain cuit au feu de bois…" />
            <div>
              <Label label="Vos services" optional />
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((v) => <Chip key={v} active={b.services.includes(v)} onClick={() => toggle("services", v)}>{v}</Chip>)}
              </div>
            </div>
            <div>
              <Label label="Paiements acceptés" optional />
              <div className="flex flex-wrap gap-2">
                {PAYMENTS.map((v) => <Chip key={v} active={b.payments.includes(v)} onClick={() => toggle("payments", v)}>{v}</Chip>)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Ouvert depuis" optional value={b.since} onChange={set("since")} placeholder="Ex. 1998" />
              <Input label="Langues parlées" optional value={b.languages} onChange={set("languages")} placeholder="Ex. anglais, italien" />
            </div>
            <Input label="Vos clients" optional value={b.audience} onChange={set("audience")} placeholder="Ex. familles du quartier, touristes l'été, travailleurs le midi" />
          </Section>
        )}

        {step === 4 && (
          <Section title="Horaires et contact" subtitle="Tout est facultatif. Ce que vous laissez vide n'apparaîtra pas.">
            <Area label="Horaires" optional rows={3} value={b.hours} onChange={set("hours")}
              placeholder="Ex. du mardi au samedi, 12h-14h et 19h-22h. Fermé dimanche et lundi." />
            <Input label="Adresse" optional value={b.address} onChange={set("address")} placeholder="Ex. 12 rue des Tanneurs, 13100 Aix-en-Provence" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Téléphone" optional value={b.phone} onChange={set("phone")} placeholder="04 42 00 00 00" type="tel" />
              <Input label="E-mail" optional value={b.email} onChange={set("email")} placeholder="contact@exemple.fr" type="email" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Instagram" optional value={b.instagram} onChange={set("instagram")} placeholder="@moncommerce" />
              <Input label="Facebook" optional value={b.facebook} onChange={set("facebook")} placeholder="Nom de la page ou lien" />
            </div>
          </Section>
        )}

        {step === 5 && (
          <Section title="Une vidéo de présentation ?" subtitle="Elle se lance toute seule en haut de votre site, sans le son. Les sites avec une vidéo donnent bien plus envie de venir.">
            <VideoChoice b={b} setB={setB} />
          </Section>
        )}

        {step === 6 && (
          <Section title="Quelle ambiance pour votre site ?" subtitle="Touchez celle qui vous ressemble. Vous pourrez en changer plus tard.">
            <div className="grid grid-cols-2 gap-3">
              {MOODS.map((m, k) => (
                <MoodCard key={m.id} mood={m} index={k} active={b.mood === m.id} onClick={() => set("mood")(m.id)} />
              ))}
            </div>
          </Section>
        )}
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="mt-10 flex items-center justify-between gap-3">
        <button
          onClick={() => (step === 0 ? router.push("/tableau-de-bord") : setStep(step - 1))}
          className="rounded-full px-5 py-3 text-sm font-medium text-muted transition hover:text-ink"
        >
          ← {step === 0 ? "Annuler" : "Retour"}
        </button>
        {step < STEPS.length - 1 ? (
          <button disabled={!canNext} onClick={() => setStep(step + 1)}
            className="rounded-full bg-ink px-7 py-3.5 font-medium text-cream transition disabled:opacity-30">
            {step === 3 && !b.specialties && !b.services.length && !b.payments.length && !b.since && !b.languages && !b.audience ? "Passer" : "Continuer"}
          </button>
        ) : (
          <button disabled={!canNext} onClick={submit}
            className="rounded-full bg-clic px-7 py-3.5 font-medium text-white shadow-[0_10px_30px_-10px_rgba(255,91,31,.6)] transition hover:bg-clic-dark disabled:opacity-30">
            Créer mon site
          </button>
        )}
      </div>
    </div>
  );
}

export function Generating({ steps = LOADING, mood = "" }: { steps?: string[]; mood?: string }) {
  const [i, setI] = useState(0);
  const [pct, setPct] = useState(3);
  const [palette, setPalette] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 9000);
    // Progression qui ralentit en approchant de la fin (la création prend environ une minute).
    const b = setInterval(() => setPct((p) => Math.min(96, p + Math.max(0.25, (96 - p) / 28))), 600);
    const c = setInterval(() => setPalette((n) => n + 1), 2600);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, [steps.length]);
  // Le téléphone essaie des couleurs, puis se pose sur l'ambiance choisie.
  const chosen = MOODS.find((m) => m.id === mood)?.theme;
  const order = chosen ? [chosen] : MOODS.map((m) => m.theme);
  const t = THEMES[order[palette % order.length]];
  const c = t.colors;
  const block = (delay: number, style: React.CSSProperties, shim = false) => (
    <span className={`gen-b ${shim ? "gen-shim" : ""}`} style={{ animationDelay: `${delay}s`, ...style }} />
  );
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center" role="status" aria-live="polite">
      <div className="gen-phone">
        <div className="gen-screen" style={{ background: c.bg }}>
          <div className="flex items-center justify-between px-3.5 pt-4">
            {block(0.2, { width: 54, height: 6, background: c.ink, opacity: 0.7 })}
            {block(0.4, { width: 34, height: 12, background: c.accent, borderRadius: 99 })}
          </div>
          <div className="px-3.5 pt-8">
            {block(1, { width: 60, height: 5, background: c.accent })}
            <div className="mt-3 space-y-2">
              {block(2, { width: "92%", height: 16, background: c.ink }, true)}
              {block(3, { width: "70%", height: 16, background: c.ink }, true)}
            </div>
            <div className="mt-4 space-y-1.5">
              {block(4.5, { width: "88%", height: 5, background: c.muted, opacity: 0.6 })}
              {block(5, { width: "64%", height: 5, background: c.muted, opacity: 0.6 })}
            </div>
            {block(6.5, { width: 92, height: 24, marginTop: 16, background: c.accent, borderRadius: 99 })}
          </div>
          <div className="absolute inset-x-0 bottom-0 px-3.5 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {block(8, { height: 70, background: c.surface, borderRadius: 10 }, true)}
              {block(9, { height: 70, background: c.surface, borderRadius: 10 }, true)}
            </div>
            {block(10.5, { height: 18, marginTop: 8, background: c.band, borderRadius: 6 })}
          </div>
          <span className="gen-cursor" aria-hidden />
        </div>
      </div>

      <h2 className="mt-10 font-display text-3xl font-extrabold tracking-tight">Votre site prend forme</h2>
      <div className="mt-4 w-full max-w-xs">
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-clic transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-right text-xs tabular-nums text-muted">{Math.round(pct)} %</p>
      </div>
      <ul className="mt-4 w-full max-w-xs space-y-2 text-left text-sm">
        {steps.map((st, k) => (
          <li key={st} className={`gen-step flex items-center gap-2.5 ${k < i ? "text-ink" : k === i ? "text-ink" : "text-muted/50"}`}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${k < i ? "bg-clic text-white" : k === i ? "border-2 border-clic border-t-transparent animate-spin" : "border border-line"}`}>
              {k < i ? "✓" : ""}
            </span>
            {st.replace(/…$/, "")}
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted/70">Environ une minute. Ne fermez pas cette page.</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      <div className="mt-8 space-y-5">{children}</div>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`wiz-choice rounded-2xl border px-4 py-4 text-left transition active:scale-[.97] ${active ? "is-on border-clic bg-clic/10 text-ink" : "border-line bg-card text-ink/85 hover:-translate-y-0.5 hover:border-ink/30"}`}>
      {children}
    </button>
  );
}

const fieldCls =
  "w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-base outline-none transition placeholder:text-muted/50 focus:border-ink/60 focus:ring-4 focus:ring-ink/5";

function VideoChoice({ b, setB }: { b: Brief; setB: React.Dispatch<React.SetStateAction<Brief>> }) {
  const ref = useRef<HTMLInputElement>(null);
  const clipRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  async function addClips(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, 5 - b.videoClips.length);
    if (!list.length) return;
    try {
      for (const [k, f] of list.entries()) {
        setStatus(`Envoi du clip ${k + 1} sur ${list.length}… (gardez l'appli ouverte)`);
        const url = await uploadVideo(f, "creation");
        setB((p) => ({ ...p, video: "auto", videoClips: [...p.videoClips, url] }));
      }
      setStatus("Clips reçus ✓ Nous en ferons un film.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Envoi impossible.");
    }
  }
  async function pick(file: File | undefined) {
    if (!file) return;
    setStatus("Envoi de la vidéo… (gardez l'appli ouverte)");
    try {
      const url = await uploadVideo(file, "creation");
      setB((p) => ({ ...p, video: "perso", videoUrl: url }));
      setStatus("Vidéo reçue ✓");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Envoi impossible.");
    }
  }
  return (
    <div>
      <div className="grid gap-2.5">
        <Choice active={b.video === "auto"} onClick={() => setB((p) => ({ ...p, video: "auto" }))}>
          <span className="flex items-center gap-2 font-semibold">Oui, faites-la pour moi <span className="rounded-full bg-clic px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Conseillé</span></span>
          <span className="mt-0.5 block text-sm opacity-60">Nous montons un film avec vos petits clips ou vos photos, vos textes et votre nom. Gratuit.</span>
        </Choice>
        <Choice active={b.video === "perso"} onClick={() => (b.videoUrl ? setB((p) => ({ ...p, video: "perso" })) : ref.current?.click())}>
          <span className="block font-semibold">{b.videoUrl ? "Ma vidéo ✓" : "J'ai déjà ma vidéo"}</span>
          <span className="mt-0.5 block text-sm opacity-60">Choisissez-la dans votre galerie (30 secondes suffisent).</span>
        </Choice>
        <Choice active={b.video === "non"} onClick={() => setB((p) => ({ ...p, video: "non" }))}>
          <span className="block font-semibold">Pas de vidéo</span>
          <span className="mt-0.5 block text-sm opacity-60">Vous pourrez en ajouter une plus tard.</span>
        </Choice>
      </div>
      {b.video === "auto" && (
        <div className="mt-3 rounded-xl border border-line p-3">
          <p className="text-xs leading-relaxed text-muted">
            Encore mieux : filmez 3 à 5 petits moments de 5 secondes (la salle, un plat, l&apos;équipe…). Nous les montons en film avec vos textes. Sinon, le film sera fait avec vos photos.
          </p>
          {b.videoClips.length < 5 && (
            <button type="button" onClick={() => clipRef.current?.click()} className="mt-2 rounded-full border border-line px-4 py-2 text-sm hover:border-ink/60">
              {b.videoClips.length ? `+ Ajouter un clip (${b.videoClips.length}/5)` : "+ Ajouter mes petits clips"}
            </button>
          )}
          <input ref={clipRef} type="file" accept="video/*" multiple hidden onChange={(e) => { void addClips(e.target.files); e.target.value = ""; }} />
        </div>
      )}
      {b.video === "perso" && b.videoUrl && (
        <button type="button" onClick={() => ref.current?.click()} className="mt-2 text-sm text-muted underline underline-offset-4">Changer de vidéo</button>
      )}
      {status && <p className="mt-2 text-xs text-muted" role="status">{status}</p>}
      <input ref={ref} type="file" accept="video/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

function MoodCard({ mood, index, active, onClick }: { mood: (typeof MOODS)[number]; index: number; active: boolean; onClick: () => void }) {
  const t = THEMES[mood.theme];
  const c = t.colors;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{ animationDelay: `${index * 60}ms` }}
      className={`wiz-mood group rounded-2xl border p-2 text-left transition active:scale-[.97] ${active ? "is-on border-clic bg-clic/10" : "border-line bg-card hover:-translate-y-0.5 hover:border-ink/30"}`}>
      {/* Petite vignette : à quoi ressemblera le site */}
      <span className={`${t.fontClasses} block overflow-hidden border border-black/10`} style={{ background: c.bg, borderRadius: `min(${t.radius}, 12px)` }} aria-hidden>
        <span className="flex items-center justify-between px-2.5 pt-2">
          <span className="h-1 w-8 rounded-full" style={{ background: c.ink, opacity: 0.55 }} />
          <span className="h-2.5 w-7" style={{ background: c.accent, borderRadius: t.btnRadius === "999px" ? 99 : 1 }} />
        </span>
        <span className="block px-2.5 pb-1 pt-3 text-[26px] leading-none transition-transform duration-500 group-hover:scale-105"
          style={{ color: c.ink, fontFamily: `${t.display}, serif`, fontWeight: t.displayWeight, letterSpacing: t.displayTracking }}>
          Aa
        </span>
        <span className="mx-2.5 mb-2.5 mt-1.5 block h-1 w-14 rounded-full" style={{ background: c.muted, opacity: 0.5 }} />
        <span className="block h-3" style={{ background: c.band }} />
      </span>
      <span className="block px-1.5 pb-1 pt-2.5 font-semibold">{active && "✓ "}{mood.label}</span>
      <span className="block px-1.5 pb-1 text-sm opacity-60">{mood.hint}</span>
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`rounded-full border px-3.5 py-2 text-sm transition ${active ? "border-clic bg-clic/15 text-ink" : "border-line text-muted hover:border-ink/40 hover:text-ink"}`}>
      {active && "✓ "}{children}
    </button>
  );
}

function Label({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
      {label}
      {optional && <span className="text-xs font-normal text-muted">facultatif</span>}
    </span>
  );
}

function Input({ label, optional, value, onChange, placeholder, type = "text" }: {
  label: string; optional?: boolean; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <Label label={label} optional={optional} />
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={fieldCls} />
    </label>
  );
}

function Area({ label, optional, value, onChange, placeholder, rows = 4 }: {
  label: string; optional?: boolean; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <label className="block">
      <Label label={label} optional={optional} />
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${fieldCls} resize-none leading-relaxed`} />
    </label>
  );
}
