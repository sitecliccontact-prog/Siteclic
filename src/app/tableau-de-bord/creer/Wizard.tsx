"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TRADES = [
  "Restaurant", "Boulangerie", "Pâtisserie", "Café", "Coiffeur", "Barbier",
  "Institut de beauté", "Fleuriste", "Boutique", "Artisan", "Bar", "Autre",
];

const MOODS = [
  { id: "Chaleureux et convivial", label: "Chaleureux", hint: "Accueillant, familial" },
  { id: "Chic et raffiné", label: "Chic", hint: "Élégant, feutré" },
  { id: "Moderne et épuré", label: "Moderne", hint: "Net, graphique" },
  { id: "Naturel et doux", label: "Naturel", hint: "Simple, apaisant" },
];

type Brief = {
  trade: string; name: string; city: string; address: string; phone: string; email: string;
  offer: string; hours: string; story: string; mood: string;
};

const EMPTY: Brief = { trade: "", name: "", city: "", address: "", phone: "", email: "", offer: "", hours: "", story: "", mood: "" };

const STEPS = ["Votre métier", "Votre commerce", "Ce que vous proposez", "Horaires et contact", "L'ambiance"];

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
  const set = (k: keyof Brief) => (v: string) => setB((p) => ({ ...p, [k]: v }));

  const canNext = [
    b.trade.trim().length > 0,
    b.name.trim().length > 0,
    b.offer.trim().length > 10,
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
      if (!res.ok) throw new Error(data.error || "La création a échoué. Réessayez dans un instant.");
      router.push(`/apercu/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La création a échoué.");
      setLoading(false);
    }
  }

  if (loading) return <Generating />;

  return (
    <div className="mx-auto max-w-xl">
      {/* Progression */}
      <div className="mb-10 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition ${i <= step ? "bg-clic" : "bg-line"}`} />
        ))}
      </div>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">
        Étape {step + 1} sur {STEPS.length}
      </p>

      <div key={step} className="rise">
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
          <Section title="Horaires et contact" subtitle="Tout est facultatif. Ce que vous laissez vide n'apparaîtra pas.">
            <Area label="Horaires" optional rows={3} value={b.hours} onChange={set("hours")}
              placeholder="Ex. du mardi au samedi, 12h-14h et 19h-22h. Fermé dimanche et lundi." />
            <Input label="Adresse" optional value={b.address} onChange={set("address")} placeholder="Ex. 12 rue des Tanneurs, 13100 Aix-en-Provence" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Téléphone" optional value={b.phone} onChange={set("phone")} placeholder="04 42 00 00 00" type="tel" />
              <Input label="E-mail" optional value={b.email} onChange={set("email")} placeholder="contact@exemple.fr" type="email" />
            </div>
          </Section>
        )}

        {step === 4 && (
          <Section title="Quelle ambiance pour votre site ?">
            <div className="grid grid-cols-2 gap-2.5">
              {MOODS.map((m) => (
                <Choice key={m.id} active={b.mood === m.id} onClick={() => set("mood")(m.id)}>
                  <span className="block font-semibold">{m.label}</span>
                  <span className="mt-0.5 block text-sm opacity-60">{m.hint}</span>
                </Choice>
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
            Continuer
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

export function Generating({ steps = LOADING }: { steps?: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 9000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center" role="status" aria-live="polite">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-clic/20" />
        <div className="absolute inset-3 animate-pulse rounded-full bg-clic/40" />
        <div className="absolute inset-7 rounded-full bg-clic" />
      </div>
      <h2 className="mt-10 font-display text-3xl font-extrabold tracking-tight">Votre site prend forme</h2>
      <p key={i} className="rise mt-3 text-muted">{steps[i]}</p>
      <p className="mt-8 text-sm text-muted/70">Cela prend environ une minute. Ne fermez pas cette page.</p>
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
      className={`rounded-2xl border px-4 py-4 text-left transition ${active ? "border-clic bg-clic/10 text-ink" : "border-line bg-card text-ink/85 hover:border-ink/30"}`}>
      {children}
    </button>
  );
}

const fieldCls =
  "w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-base outline-none transition placeholder:text-muted/50 focus:border-ink/60 focus:ring-4 focus:ring-ink/5";

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
