/* Grille de prix SiteClic (décidée le 23/11). Un seul endroit à changer si les prix bougent. */

export const EDITS_PER_SITE = 50;

export const OFFERS = [
  {
    id: "site",
    name: "Un site",
    price: "20 €",
    cents: 2000,
    unit: "paiement unique",
    note: "",
    features: ["Créé ou repris de votre site actuel par l'IA", `${EDITS_PER_SITE} modifications par l'IA incluses`, "Mise en ligne en un clic"],
    highlight: false,
  },
  {
    id: "pack5",
    name: "Pack 5 sites",
    price: "50 €",
    cents: 5000,
    unit: "paiement unique",
    note: "soit 10 € le site",
    features: ["5 sites, pour vous ou vos commerces", `${EDITS_PER_SITE} modifications par l'IA par site`, "Mise en ligne en un clic"],
    highlight: true,
  },
] as const;

/** Commission SiteClic sur les paiements des réservations (empreinte prélevée ou acompte). */
export const BOOKING_FEE = 0.02;

/** Relief de fond créé par l'IA : 1 € = 5 créations (coût IA ≈ 1 centime chacune, bien sous 30 centimes par achat). */
export const RELIEF_PACK = { price: "1 €", cents: 100, tries: 5 };

/** Hébergement pour garder le site en ligne. */
export const HOSTING = { year: "30 €", yearMonthly: "2,50 €", month: "2,90 €", yearCents: 3000, monthCents: 290 };
export type OfferId = (typeof OFFERS)[number]["id"];

/** Option « Assistant IA de réservation », payée au mois par le commerçant (décidée le 26/11).
    Sans option, ou quand la limite du mois est atteinte, le site garde la réservation classique. */
export const AI_PLANS = [
  { id: "essentiel", name: "Essentiel", price: "15 €", quota: 300, note: "Pour un petit commerce" },
  { id: "pro", name: "Pro", price: "39 €", quota: 1000, note: "Pour les maisons très demandées" },
] as const;
export type AiPlanId = (typeof AI_PLANS)[number]["id"];

/** Options en plus pour les commerçants (proposées le 27/11). Débloquées sur les comptes propriétaire SiteClic. */
export const OPTIONS = {
  domaine: { name: "Nom de domaine", price: "15 €/an" },
  newsletter: { name: "Newsletter / SMS", price: "5 €/mois" },
  evenements: { name: "Événements et soirées", price: "4 €/mois" },
  allergenes: { name: "Allergènes par l'IA", price: "3 € une fois" },
  emploi: { name: "Offres d'emploi", price: "3 €/mois" },
  rapport: { name: "Rapport du lundi", price: "Inclus" },
  parrainage: { name: "Parrainage", price: "Inclus" },
  notifications: { name: "Notifications", price: "Inclus" },
} as const;
export type OptionId = keyof typeof OPTIONS;
