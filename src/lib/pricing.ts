/* Grille de prix SiteClic (décidée le 23/11). Un seul endroit à changer si les prix bougent. */

export const EDITS_PER_SITE = 50;

export const OFFERS = [
  {
    id: "site",
    name: "Un site",
    price: "20 €",
    unit: "paiement unique",
    note: "",
    features: ["Créé ou repris de votre site actuel par l'IA", `${EDITS_PER_SITE} modifications par l'IA incluses`, "Mise en ligne en un clic"],
    highlight: false,
  },
  {
    id: "pack5",
    name: "Pack 5 sites",
    price: "50 €",
    unit: "paiement unique",
    note: "soit 10 € le site",
    features: ["5 sites, pour vous ou vos commerces", `${EDITS_PER_SITE} modifications par l'IA par site`, "Mise en ligne en un clic"],
    highlight: true,
  },
] as const;

/** Hébergement pour garder le site en ligne. */
export const HOSTING = { year: "30 €", yearMonthly: "2,50 €", month: "2,90 €" };
