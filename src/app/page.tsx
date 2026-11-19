import Link from "next/link";
import { Logo } from "@/components/Logo";

const trades = ["Restaurants", "Boulangeries", "Coiffeurs", "Fleuristes", "Instituts de beauté", "Cafés", "Artisans", "Boutiques"];

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <Nav />
      <Hero />
      <Trades />
      <HowItWorks />
      <TwoWays />
      <EditByWriting />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}

/* ---------- Navigation ---------- */
function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#comment" className="hover:text-ink">Comment ça marche</a>
          <a href="#tarif" className="hover:text-ink">Tarif</a>
          <a href="#questions" className="hover:text-ink">Questions</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/connexion" className="hidden rounded-full px-4 py-2 text-sm font-medium hover:bg-sand sm:block">
            Se connecter
          </Link>
          <Link href="/inscription" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-black">
            Créer mon site
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="grain relative">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-24">
        <div>
          <p className="rise inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-clic" /> Pour les commerces de quartier
          </p>
          <h1 className="rise rise-2 mt-6 font-display text-[2.9rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl md:text-[4.4rem]">
            L&apos;élégance d&apos;une agence.{" "}
            <span className="block text-ink/40">La simplicité d&apos;un <em className="font-medium italic text-clic">clic</em>.</span>
          </h1>
          <p className="rise rise-3 mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Décrivez votre commerce, notre IA crée un site élégant en quelques minutes. Vous avez déjà un site ? Elle le rend
            plus beau. Ensuite, vous le modifiez simplement en écrivant.
          </p>
          <div className="rise rise-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className="rounded-full bg-clic px-7 py-4 text-center font-medium text-white shadow-[0_10px_30px_-10px_rgba(255,91,31,.6)] transition hover:bg-clic-dark">
              Créer mon site gratuitement
            </Link>
            <a href="#comment" className="rounded-full border border-ink/15 px-7 py-4 text-center font-medium transition hover:border-ink">
              Voir comment ça marche
            </a>
          </div>
          <p className="mt-5 text-sm text-muted">Aperçu offert · Sans engagement · Aucune compétence technique</p>
        </div>
        <PhoneMockup />
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] rise rise-2">
      <div className="absolute -inset-10 -z-10 rounded-full bg-clic/15 blur-3xl" />
      <div className="rounded-[2.6rem] bg-[#0a0a0b] p-2.5 shadow-[0_40px_80px_-30px_rgba(18,19,26,.55)]">
        <div className="overflow-hidden rounded-[2.1rem] bg-[#fbf6ee]">
          {/* Site généré (exemple fictif) */}
          <div className="flex items-center justify-between px-5 pt-5 text-[11px] text-[#3b2a20]">
            <span className="font-display text-base font-semibold">Maison Lumière</span>
            <span className="space-x-3 opacity-70"><span>Carte</span><span>Réserver</span></span>
          </div>
          <div className="relative mx-3 mt-4 h-44 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_30%,#f2b27a,transparent_55%),radial-gradient(circle_at_80%_70%,#7a3b1d,transparent_60%),linear-gradient(135deg,#c8693a,#3e1f12)]">
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <p className="absolute bottom-4 left-4 right-4 font-display text-[22px] font-semibold leading-tight text-white">
              Cuisine de saison, au cœur du village
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 px-3 pt-3">
            {["#d9a066", "#8c4a2b", "#e9c9a1"].map((c) => (
              <div key={c} className="h-16 rounded-xl" style={{ background: `linear-gradient(140deg, ${c}, #2b1a12)` }} />
            ))}
          </div>
          <div className="px-5 py-4 text-[11px] leading-relaxed text-[#3b2a20]">
            <p className="font-semibold uppercase tracking-[0.16em] text-[#b0552a]">Horaires</p>
            <p className="mt-1 opacity-80">Mar. – Sam. · 12h – 14h30 · 19h – 22h</p>
            <div className="mt-3 rounded-full bg-[#3b2a20] py-2 text-center text-[11px] font-medium text-[#fbf6ee]">Réserver une table</div>
          </div>
        </div>
      </div>
      {/* Bulle de discussion */}
      <div className="absolute -left-4 bottom-32 w-56 rounded-2xl rounded-bl-md border border-line bg-card p-3.5 text-[13px] shadow-xl sm:-left-16">
        « On ferme à 19h le samedi »
      </div>
      <div className="absolute -right-2 -bottom-6 flex items-center gap-2 rounded-2xl rounded-br-md bg-ink px-3.5 py-3 text-[13px] text-cream shadow-xl sm:-right-10">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-clic text-[10px]">✓</span>
        C&apos;est fait, votre site est à jour.
      </div>
    </div>
  );
}

/* ---------- Métiers ---------- */
function Trades() {
  return (
    <section className="border-y border-line bg-card/60">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-3 px-5 py-6 text-sm text-muted">
        {trades.map((t) => (
          <span key={t} className="font-display text-base italic">{t}</span>
        ))}
      </div>
    </section>
  );
}

/* ---------- Comment ça marche ---------- */
function HowItWorks() {
  const steps = [
    { n: "01", t: "Parlez-nous de vous", d: "Le nom de votre commerce, votre ville, vos horaires, ce que vous proposez. Quelques questions simples, c'est tout." },
    { n: "02", t: "L'IA crée votre site", d: "Textes, mise en page, couleurs : un site élégant, pensé pour votre métier, s'affiche sous vos yeux." },
    { n: "03", t: "Mettez-le en ligne", d: "Un clic et vos clients vous trouvent. Ensuite, changez ce que vous voulez en écrivant, comme à un ami." },
  ];
  return (
    <section id="comment" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
      <SectionTitle eyebrow="Comment ça marche" title="Trois étapes, aucune technique." />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-3xl border border-line bg-card p-8">
            <p className="font-display text-5xl font-light text-clic">{s.n}</p>
            <h3 className="mt-6 font-display text-2xl font-semibold">{s.t}</h3>
            <p className="mt-3 leading-relaxed text-muted">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Créer ou importer ---------- */
function TwoWays() {
  return (
    <section className="bg-sand/60">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <SectionTitle eyebrow="Deux façons de commencer" title="Partez de zéro, ou de votre site actuel." />
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl bg-ink p-9 text-cream">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Pas encore de site ?</p>
            <h3 className="mt-4 font-display text-3xl font-semibold">Créez-le avec l&apos;IA</h3>
            <p className="mt-3 leading-relaxed text-cream/70">
              Répondez à quelques questions et découvrez votre site en quelques minutes. L&apos;aperçu est gratuit : vous ne payez que
              si vous le mettez en ligne.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-card p-9">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Votre site a vieilli ?</p>
            <h3 className="mt-4 font-display text-3xl font-semibold">Offrez-lui une seconde vie</h3>
            <p className="mt-3 leading-relaxed text-muted">
              Collez simplement son adresse. L&apos;IA récupère vos textes et vos photos, puis les présente dans un design moderne et
              soigné.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-dashed border-line p-4 text-muted">
                <p className="font-medium">Avant</p>
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 w-3/4 rounded bg-[#c9c9c9]" />
                  <div className="h-10 rounded bg-[#dcdcdc]" />
                  <div className="h-2 w-1/2 rounded bg-[#c9c9c9]" />
                </div>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-cream p-4">
                <p className="font-medium text-clic">Après</p>
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 w-2/3 rounded bg-ink" />
                  <div className="h-10 rounded bg-[linear-gradient(135deg,#ff5b1f,#3e1f12)]" />
                  <div className="h-2 w-1/3 rounded-full bg-clic" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Modifier en écrivant ---------- */
function EditByWriting() {
  const examples = [
    ["Change mes horaires, on ferme à 19h le samedi", "Horaires mis à jour sur toutes les pages."],
    ["Ajoute la photo de mes nouveaux croissants", "Photo ajoutée dans la galerie, en première position."],
    ["La baguette passe à 1,30 €", "Prix modifié dans votre carte."],
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid items-center gap-14 md:grid-cols-2">
        <div>
          <SectionTitle eyebrow="Modifiez en écrivant" title="Votre site change quand votre commerce change." align="left" />
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Plus besoin d&apos;appeler quelqu&apos;un ni de chercher le bon bouton. Écrivez ce que vous voulez, comme dans un message :
            c&apos;est fait en quelques secondes.
          </p>
        </div>
        <div className="space-y-4 rounded-[2rem] border border-line bg-card p-5 shadow-[0_30px_60px_-35px_rgba(18,19,26,.35)] sm:p-7">
          {examples.map(([q, a]) => (
            <div key={q} className="space-y-2">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[15px] text-cream">{q}</div>
              <div className="flex w-fit max-w-[85%] items-start gap-2 rounded-2xl rounded-bl-md bg-sand px-4 py-3 text-[15px]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-clic text-[10px] text-white">✓</span>
                {a}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-1 pt-1 text-muted">
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Tarif ---------- */
function Pricing() {
  const included = [
    "Votre site créé ou modernisé par l'IA",
    "Modifications en écrivant, quand vous voulez",
    "Mise en ligne et hébergement inclus",
    "Adapté aux téléphones et ordinateurs",
    "Sans engagement, résiliable à tout moment",
  ];
  return (
    <section id="tarif" className="scroll-mt-20 border-y border-line bg-sand">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-24 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">Tarif</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Un seul prix, tout compris.</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Créez votre site et regardez-le gratuitement. Vous ne payez que le jour où vous décidez de le mettre en ligne.
          </p>
        </div>
        <div className="rounded-[2rem] border border-line bg-card p-8 text-ink shadow-[0_40px_80px_-40px_rgba(255,91,31,.35)] sm:p-10">
          <p className="font-medium">Abonnement SiteClic</p>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-6xl font-semibold">29 €</span>
            <span className="text-muted">/ mois</span>
          </p>
          <ul className="mt-8 space-y-3.5">
            {included.map((i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-clic/15 text-[11px] text-clic">✓</span>
                {i}
              </li>
            ))}
          </ul>
          <Link href="/inscription" className="mt-9 block rounded-full bg-ink py-4 text-center font-medium text-cream transition hover:bg-black">
            Créer mon site gratuitement
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Questions ---------- */
function Faq() {
  const qs = [
    ["Faut-il savoir utiliser un ordinateur ?", "Non. Si vous savez envoyer un message sur votre téléphone, vous savez utiliser SiteClic."],
    ["Qu'est-ce qui est gratuit ?", "Créer votre site et le voir en aperçu. L'abonnement commence seulement quand vous le mettez en ligne."],
    ["Mon site actuel peut-il être repris ?", "Oui. Donnez son adresse, l'IA récupère vos textes et vos photos et les met en valeur dans un nouveau design."],
    ["Puis-je arrêter quand je veux ?", "Oui, l'abonnement est sans engagement. Vous l'arrêtez en un clic depuis votre espace."],
  ];
  return (
    <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-24">
      <SectionTitle eyebrow="Questions fréquentes" title="Vous vous demandez peut-être…" />
      <div className="mt-12 divide-y divide-line border-y border-line">
        {qs.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-medium">
              {q}
              <span className="text-2xl font-light text-clic transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ---------- Appel final ---------- */
function FinalCta() {
  return (
    <section className="px-5 pb-24">
      <div className="grain mx-auto max-w-6xl rounded-[2.5rem] border border-line bg-card px-6 py-16 text-center sm:py-20">
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Votre commerce mérite d&apos;être vu.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted">Découvrez votre futur site dans quelques minutes. C&apos;est gratuit.</p>
        <Link href="/inscription" className="mt-9 inline-block rounded-full bg-clic px-8 py-4 font-medium text-white transition hover:bg-clic-dark">
          Créer mon site gratuitement
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center">
        <Logo />
        <a href="mailto:siteclic.contact@gmail.com" className="hover:text-ink">siteclic.contact@gmail.com</a>
        <p>© {new Date().getFullYear()} SiteClic · Ton site en un clic</p>
      </div>
    </footer>
  );
}

function SectionTitle({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-clic">{eyebrow}</p>
      <h2 className={`mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl ${align === "center" ? "mx-auto max-w-2xl" : ""}`}>
        {title}
      </h2>
    </div>
  );
}
