import type { SiteContent } from "./schema";

// Exemples fictifs, utilisés seulement pour tester l'affichage en développement.
const restaurant: SiteContent = {
  theme: "bistrot",
  special: {
    title: "Menu du jour",
    text: "Velouté de potimarron, huile de noisette\nDaube provençale, polenta crémeuse\nTarte au citron meringuée\nFormule entrée, plat, dessert · 24 €",
    date: new Date().toISOString(),
  },
  brand: { name: "Le Petit Provençal", tagline: "La Provence, servie à table" },
  hero: {
    eyebrow: "Restaurant · Aix-en-Provence",
    title: "Une cuisine de marché, simple et généreuse",
    subtitle: "Chaque matin, nous faisons le marché de la place Richelme. Le midi et le soir, nous cuisinons ce que nous y avons trouvé.",
    cta: "Réserver une table",
  },
  about: {
    title: "Une maison de famille depuis 1998",
    paragraphs: [
      "Marie et Jean ont ouvert Le Petit Provençal dans une ancienne épicerie de la rue des Tanneurs. Vingt-cinq ans plus tard, la daube mijote toujours sept heures et les tians sortent du four en terre cuite.",
      "Tout est fait ici, du pain aux desserts. La carte change avec les saisons et le marché, les vins viennent de domaines que nous connaissons.",
    ],
  },
  highlights: [
    { title: "Fait maison", text: "Du pain aux desserts, tout est préparé dans notre cuisine." },
    { title: "Produits du marché", text: "Légumes, fromages et poissons achetés chaque matin à Aix." },
    { title: "Vins de la région", text: "Une sélection courte de domaines provençaux." },
  ],
  offer: {
    title: "La carte",
    intro: "Une carte courte, qui suit les saisons.",
    categories: [
      { name: "Entrées", items: [
        { name: "Tian de légumes du marché", description: "Courgettes, tomates, aubergines, huile d'olive de la vallée des Baux", price: "11 €" },
        { name: "Soupe au pistou", description: "", price: "9 €" },
      ] },
      { name: "Plats", items: [
        { name: "Daube provençale", description: "Bœuf mijoté sept heures au vin rouge, polenta crémeuse", price: "22 €" },
        { name: "Poisson du jour", description: "Selon l'arrivage, légumes rôtis", price: "24 €" },
      ] },
      { name: "Desserts", items: [
        { name: "Tarte au citron de Menton", description: "", price: "8 €" },
        { name: "Calissons maison et café", description: "", price: "6 €" },
      ] },
      { name: "Le midi", items: [{ name: "Menu du jour", description: "Entrée, plat et dessert", price: "18 €" }] },
    ],
  },
  hours: [
    { days: "Mardi – Samedi", time: "12h – 14h · 19h – 22h" },
    { days: "Dimanche – Lundi", time: "Fermé" },
  ],
  contact: { address: "12 rue des Tanneurs, 13100 Aix-en-Provence", phone: "04 42 00 00 00", email: "" },
  closing: { title: "On vous garde une table ?", text: "La salle compte vingt-quatre couverts. Pensez à réserver, surtout le vendredi et le samedi soir." },
  photos: [],
  seo: { title: "Le Petit Provençal, restaurant à Aix-en-Provence", description: "Cuisine provençale de marché, faite maison, rue des Tanneurs à Aix-en-Provence." },
};

const coiffeur: SiteContent = {
  theme: "atelier",
  brand: { name: "Maison Rivage", tagline: "Coupe, couleur, soin" },
  hero: {
    eyebrow: "Salon de coiffure · Nantes",
    title: "Des coupes pensées pour vous, pas pour la tendance",
    subtitle: "On prend le temps de vous écouter avant de prendre les ciseaux. Un salon calme, quatre fauteuils, des produits végétaux.",
    cta: "Prendre rendez-vous",
  },
  about: { title: "Un salon à taille humaine", paragraphs: [
    "Léa a ouvert Maison Rivage en 2019 après dix ans dans des salons parisiens. Elle voulait un lieu plus calme, où chaque rendez-vous commence par un vrai diagnostic.",
    "Couleurs végétales, soins sur mesure et coupes faciles à coiffer chez soi.",
  ] },
  highlights: [
    { title: "Diagnostic offert", text: "Chaque rendez-vous commence par un échange." },
    { title: "Couleurs végétales", text: "Des colorations douces pour vos cheveux." },
    { title: "Quatre fauteuils", text: "Un salon calme, sans attente." },
  ],
  offer: { title: "Prestations", intro: "Tarifs indicatifs, cheveux courts à longs.", categories: [
    { name: "Coupes", items: [
      { name: "Coupe femme", description: "Shampooing, coupe, brushing", price: "48 €" },
      { name: "Coupe homme", description: "", price: "29 €" },
    ] },
    { name: "Couleur", items: [
      { name: "Couleur végétale", description: "", price: "65 €" },
      { name: "Balayage", description: "", price: "95 €" },
    ] },
  ] },
  hours: [{ days: "Mardi – Vendredi", time: "9h30 – 19h" }, { days: "Samedi", time: "9h – 17h" }],
  contact: { address: "4 quai de la Fosse, 44000 Nantes", phone: "02 40 00 00 00", email: "bonjour@maisonrivage.fr" },
  closing: { title: "Votre prochaine coupe commence ici", text: "Réservez par téléphone, du mardi au samedi." },
  photos: [],
  seo: { title: "Maison Rivage, salon de coiffure à Nantes", description: "Coupes, couleurs végétales et soins sur mesure, quai de la Fosse à Nantes." },
};

const boulangerie: SiteContent = {
  ...restaurant,
  theme: "terracotta",
  brand: { name: "Fournil Saint-Jean", tagline: "Le pain comme avant" },
  hero: {
    eyebrow: "Boulangerie · Lyon 5e",
    title: "Du levain, du temps et de la farine bio",
    subtitle: "Nos pains lèvent dix-huit heures. Nos viennoiseries sortent du four à 7 heures, tous les matins sauf le lundi.",
    cta: "Nous appeler",
  },
  offer: { title: "Nos pains", intro: "", categories: [
    { name: "Pains", items: [
      { name: "Tradition", description: "", price: "1,30 €" },
      { name: "Grand levain", description: "Le kilo", price: "7,50 €" },
    ] },
    { name: "Viennoiseries", items: [
      { name: "Croissant pur beurre", description: "", price: "1,40 €" },
      { name: "Pain au chocolat", description: "", price: "1,50 €" },
    ] },
  ] },
};

export const SAMPLE_SITES: Record<string, SiteContent> = {
  bistrot: restaurant,
  atelier: coiffeur,
  terracotta: boulangerie,
  minuit: { ...restaurant, theme: "minuit" },
  jardin: { ...coiffeur, theme: "jardin" },
};
