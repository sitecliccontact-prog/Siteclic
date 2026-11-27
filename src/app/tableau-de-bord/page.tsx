import type { Metadata } from "next";
import { isTeam } from "@/lib/team";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ManageButton } from "@/components/BillingButtons";
import { Logo } from "@/components/Logo";
import { billingEnabled, getSubscription } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { Backdrop } from "./Backdrop";
import { greeting, todayLabel } from "./greeting";
import { SignOutButton } from "./SignOutButton";
import { NotifyCard, ReferralCard } from "./Extras";
import { WeekCard, type WeekRow } from "./WeekCard";
import { serverKeyHash } from "@/lib/push";

export const metadata: Metadata = { title: "Mes sites · SiteClic" };
export const dynamic = "force-dynamic";

type Reservation = { id: string; site_id: string; name: string; phone: string; day: string; time: string; people: number; message: string; created_at: string };

type SiteRow = { id: string; name: string; trade: string | null; status: string; created_at: string; photos?: unknown; theme?: unknown };

/** Couleurs de fond / d'accent de chaque style, pour la vignette quand le site n'a pas de photo. */
const SWATCH: Record<string, [string, string, string]> = {
  bistrot: ["#10201a", "#c8a45e", "#efe7d4"],
  atelier: ["#ffffff", "#e63312", "#0d0d0d"],
  terracotta: ["#f5ece0", "#bf5b2c", "#3b2416"],
  minuit: ["#0b0f1a", "#c6a66b", "#ebe4d2"],
  jardin: ["#eef0e7", "#5f7f63", "#1e2a21"],
  riviera: ["#f7f4ee", "#1d5f8c", "#0f2539"],
  galerie: ["#fafaf7", "#121212", "#121212"],
  retro: ["#f3e9d7", "#8c1c1f", "#2b1a13"],
};

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const shopName = (user.user_metadata?.shop_name as string) || "";

  const { data, error } = await supabase
    .from("sites")
    .select("id, name, trade, status, created_at, photos:content->photos, theme:content->theme")
    .order("created_at", { ascending: false });
  if (error) console.error("Lecture des sites impossible", error);
  const sites = (data ?? []) as SiteRow[];
  const sub = billingEnabled() ? await getSubscription(user).catch(() => null) : null;
  const hello = greeting(shopName);
  // Demandes de réservation (si le texte SQL 06 a été lancé ; sinon rien ne s'affiche).
  const { data: resa } = await supabase
    .from("reservations")
    .select("id, site_id, name, phone, day, time, people, message, created_at")
    .gte("day", new Date().toISOString().slice(0, 10))
    .order("day", { ascending: true })
    .order("time", { ascending: true })
    .limit(30);
  const reservations = (resa ?? []) as Reservation[];
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  // Compte propriétaire : enregistre l'empreinte de la clé du serveur (pour les notifications et le rapport du lundi).
  if (isTeam(user)) await supabase.rpc("server_key_set", { p_hash: serverKeyHash() }).then(() => null, () => null);
  const { data: weekData } = sites.some((s) => s.status === "en_ligne") ? await supabase.rpc("my_week") : { data: null };
  const week = (Array.isArray(weekData) ? weekData : []) as WeekRow[];

  return (
    <main className="relative isolate min-h-dvh overflow-x-clip px-5 py-6">
      <Backdrop />
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        <SignOutButton />
      </header>

      <section className="mx-auto mt-16 max-w-5xl sm:mt-24">
        <p className="rise flex items-center gap-2 text-sm font-medium text-ink/70">
          <span className="h-1.5 w-1.5 rounded-full bg-clic" />
          {todayLabel()}
        </p>
        <h1 className="rise rise-2 mt-4 max-w-3xl text-balance font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          {hello.title}
        </h1>
        <p className="rise rise-3 mt-4 max-w-xl text-lg leading-relaxed text-ink/70">{hello.line}</p>
        <p className="rise rise-3 mt-3 text-xs text-muted/70">Connecté avec {user.email}</p>
        {error && (
          <p role="alert" className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Impossible d&apos;afficher vos sites pour le moment. (code BDD-{error.code} : {error.message.slice(0, 120)})
          </p>
        )}

        {billingEnabled() && (
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card/80 px-5 py-4 text-sm backdrop-blur">
            {sub?.active ? (
              <>
                <span className="flex items-center gap-2 font-medium"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Abonnement actif</span>
                <ManageButton className="ml-auto text-muted underline underline-offset-4 hover:text-ink" />
              </>
            ) : (
              <>
                <span className="text-muted">Aperçu gratuit. Mettez votre site en ligne à partir de 20 €.</span>
                <Link href="/abonnement" className="ml-auto rounded-full bg-clic px-4 py-2 font-medium text-white">Voir les tarifs</Link>
              </>
            )}
          </div>
        )}

        {reservations.length > 0 && (
          <div className="mt-14">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-clic" /> Réservations à venir
              </h2>
              <Link href="/tableau-de-bord/reservations" className="text-sm font-medium text-clic">Tableau complet →</Link>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {reservations.slice(0, 4).map((r) => <ReservationCard key={r.id} r={r} site={sites.length > 1 ? siteName.get(r.site_id) : undefined} />)}
            </ul>
          </div>
        )}

        {sites.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 text-sm">
            <Link href="/tableau-de-bord/reservations" className="rounded-full border border-line bg-card/80 px-4 py-2 hover:border-ink/50">Réservations</Link>
            <Link href="/tableau-de-bord/commandes" className="rounded-full border border-line bg-card/80 px-4 py-2 hover:border-ink/50">Commandes et cartes cadeaux</Link>
            <Link href="/tableau-de-bord/clients" className="rounded-full border border-line bg-card/80 px-4 py-2 hover:border-ink/50">Inscrits et candidatures</Link>
            {isTeam(user) && <Link href="/tableau-de-bord/statistiques" className="rounded-full border border-clic/60 bg-clic/10 px-4 py-2 text-ink">📊 Mes statistiques</Link>}
          </div>
        )}

        {week.length > 0 && <WeekCard week={week} />}

        {sites.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <NotifyCard />
            <ReferralCard />
          </div>
        )}

        {sites.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Vos sites</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {sites.map((s) => <SiteCard key={s.id} site={s} />)}
            </ul>
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <ActionCard
            href="/tableau-de-bord/creer"
            title={sites.length ? "Créer un autre site" : "Créer mon site"}
            text="Répondez à quelques questions, l'IA crée un site élégant pour votre commerce."
            icon="spark"
            primary
          />
          <ActionCard
            href="/tableau-de-bord/photo"
            title="Créer avec une photo"
            text="Photographiez votre vitrine ou votre carte : l'IA lit tout et crée votre site en une minute."
            icon="camera"
          />
          <ActionCard
            href="/tableau-de-bord/importer"
            title="Importer mon site actuel"
            text="Collez l'adresse de votre site, l'IA en fait une version plus belle et plus moderne."
            icon="import"
          />
        </div>

        <p className="mt-12 text-sm text-muted">
          <Link href="/" className="underline underline-offset-4">Retour à l&apos;accueil</Link>
        </p>
      </section>
    </main>
  );
}

function ReservationCard({ r, site }: { r: Reservation; site?: string }) {
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${r.day}T12:00:00Z`));
  const isNew = Date.now() - Date.parse(r.created_at) < 24 * 3600 * 1000;
  return (
    <li className="min-w-0 rounded-3xl border border-line bg-card/80 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold first-letter:uppercase">{day} · {r.time.replace(":", "h")}</p>
          <p className="mt-0.5 text-sm text-muted">{r.people} {r.people > 1 ? "personnes" : "personne"} · {r.name}{site ? ` · ${site}` : ""}</p>
        </div>
        {isNew && <span className="shrink-0 rounded-full bg-clic/15 px-2.5 py-1 text-xs font-medium text-clic">Nouveau</span>}
      </div>
      {r.message && <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-sm text-ink/80">{r.message}</p>}
      <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="mt-4 inline-flex rounded-full bg-clic px-4 py-2 text-sm font-medium text-white">
        Appeler pour confirmer · {r.phone}
      </a>
    </li>
  );
}

function SiteCard({ site: s }: { site: SiteRow }) {
  const photo = Array.isArray(s.photos) && typeof s.photos[0] === "string" ? s.photos[0] : null;
  const [bg, accent, ink] = SWATCH[typeof s.theme === "string" ? s.theme : ""] ?? SWATCH.minuit;
  const online = s.status === "en_ligne";
  return (
    <li className="min-w-0">
      <Link href={`/tableau-de-bord/sites/${s.id}`}
        className="group flex items-center gap-4 rounded-3xl border border-line bg-card/80 p-3 pr-5 backdrop-blur transition hover:border-ink/30">
        <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl" style={{ background: bg }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <>
              <span className="font-display text-3xl font-semibold" style={{ color: ink }}>{s.name.trim().charAt(0).toUpperCase()}</span>
              <span className="absolute bottom-3 left-1/2 h-px w-6 -translate-x-1/2" style={{ background: accent }} />
            </>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block font-display text-lg font-semibold leading-tight">{s.name}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${online ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-muted/60"}`} />
              {online ? "En ligne" : "Aperçu"}
            </span>
            {s.trade && <span>{s.trade}</span>}
          </span>
        </span>
        <span className="text-clic transition group-hover:translate-x-0.5" aria-hidden>→</span>
      </Link>
    </li>
  );
}

const ICONS = {
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  import: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 19h14" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
};

function ActionCard({ title, text, badge, primary, href, icon }: { title: string; text: string; badge?: string; primary?: boolean; href?: string; icon?: keyof typeof ICONS }) {
  const body = (
    <div className={`relative h-full rounded-3xl border p-7 transition ${primary ? "border-ink bg-ink text-cream" : "border-line bg-card/80 backdrop-blur"} ${href ? "hover:-translate-y-0.5" : ""}`}>
      {badge && (
        <span className={`mb-5 inline-block rounded-full px-3 py-1 text-xs font-medium ${primary ? "bg-cream/10 text-cream" : "bg-sand text-muted"}`}>
          {badge}
        </span>
      )}
      {icon && (
        <span className={`mb-6 grid h-11 w-11 place-items-center rounded-full ${primary ? "bg-clic text-white" : "border border-line text-clic"}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[icon]}</svg>
        </span>
      )}
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className={`mt-2 text-[15px] leading-relaxed ${primary ? "text-cream/70" : "text-muted"}`}>{text}</p>
      {href && <p className="mt-5 font-medium text-clic">Commencer →</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
