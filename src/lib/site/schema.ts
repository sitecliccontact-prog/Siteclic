import { z } from "zod";

/** Les styles visuels disponibles pour les sites des clients. */
export const THEMES = ["bistrot", "atelier", "terracotta", "minuit", "jardin"] as const;
export type ThemeName = (typeof THEMES)[number];

/** Contenu d'un site client, rempli par l'IA puis modifiable. */
export const SiteContentSchema = z.object({
  theme: z.enum(THEMES).describe("Style visuel le plus adapté au commerce et à l'ambiance demandée"),
  brand: z.object({
    name: z.string().describe("Nom du commerce, tel que donné par le client"),
    tagline: z.string().describe("Signature courte et élégante, 3 à 7 mots"),
  }),
  hero: z.object({
    eyebrow: z.string().describe("Petite ligne au-dessus du titre : métier + ville, ex. « Restaurant · Aix-en-Provence »"),
    title: z.string().describe("Grand titre d'accroche, 4 à 9 mots, concret et évocateur, sans cliché"),
    subtitle: z.string().describe("Une ou deux phrases qui donnent envie de venir"),
    cta: z.string().describe("Texte du bouton principal, ex. « Réserver une table », « Prendre rendez-vous »"),
  }),
  about: z.object({
    title: z.string(),
    paragraphs: z.array(z.string()).describe("2 paragraphes courts, chaleureux et précis, à partir des informations du client"),
  }),
  highlights: z
    .array(z.object({ title: z.string(), text: z.string() }))
    .describe("Exactement 3 points forts du commerce, tirés des informations fournies"),
  offer: z.object({
    title: z.string().describe("Titre de la section, ex. « La carte », « Nos prestations », « Nos pains »"),
    intro: z.string(),
    categories: z
      .array(
        z.object({
          name: z.string(),
          items: z.array(
            z.object({
              name: z.string(),
              description: z.string().describe("Courte description appétissante ou précise ; vide si rien à dire"),
              price: z.string().describe("Prix au format « 12 € » ; vide si le client ne l'a pas donné"),
            }),
          ),
        }),
      )
      .describe("1 à 4 catégories, avec seulement des produits ou services cités par le client"),
  }),
  hours: z
    .array(z.object({ days: z.string(), time: z.string() }))
    .describe("Horaires d'ouverture regroupés, ex. { days: « Mardi – Samedi », time: « 12h – 14h30 · 19h – 22h » }"),
  contact: z.object({
    address: z.string(),
    phone: z.string(),
    email: z.string(),
  }),
  closing: z.object({
    title: z.string().describe("Phrase d'invitation finale, courte"),
    text: z.string(),
  }),
  photos: z
    .array(z.string())
    .describe("Adresses d'images à afficher (la première en grand). Uniquement des adresses fournies dans les informations ; tableau vide sinon."),
  seo: z.object({
    title: z.string().describe("Titre pour Google, 50 à 60 caractères"),
    description: z.string().describe("Description pour Google, 140 à 160 caractères"),
  }),
});

/** Réglages gérés par le commerçant lui-même (jamais par l'IA). */
export const SiteExtrasSchema = z.object({
  /** Menu ou plat du jour, affiché en haut du site le jour même. */
  special: z
    .object({ title: z.string().max(80), text: z.string().max(1200), date: z.string() })
    .nullable()
    .optional(),
  /** Bouton « Réserver une table » avec formulaire. */
  booking: z.object({ enabled: z.boolean() }).optional(),
});

/** Contenu enregistré = contenu écrit par l'IA + réglages du commerçant. */
export const StoredContentSchema = SiteContentSchema.extend(SiteExtrasSchema.shape);

export type SiteContent = z.infer<typeof StoredContentSchema>;
export type SiteExtras = z.infer<typeof SiteExtrasSchema>;

/** Garde les réglages du commerçant quand l'IA réécrit le site. */
export function keepExtras(from: SiteContent, to: SiteContent): SiteContent {
  return { ...to, special: from.special, booking: from.booking };
}

/** Le formulaire de réservation est-il proposé ? (par défaut : oui si le bouton principal parle de réserver) */
export function bookingEnabled(c: SiteContent) {
  return c.booking?.enabled ?? /r[ée]serv/i.test(c.hero.cta);
}

/** Le menu du jour est-il encore d'actualité ? (affiché pendant 20 h) */
export function specialIsFresh(c: SiteContent, now = Date.now()) {
  if (!c.special?.text.trim()) return false;
  const t = Date.parse(c.special.date);
  return Number.isFinite(t) && now - t < 20 * 3600 * 1000;
}

/** Réponses du questionnaire de création. */
export const BriefSchema = z.object({
  trade: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  city: z.string().max(80).default(""),
  address: z.string().max(160).default(""),
  phone: z.string().max(40).default(""),
  email: z.string().max(120).default(""),
  offer: z.string().min(1).max(3000),
  hours: z.string().max(600).default(""),
  story: z.string().max(1500).default(""),
  mood: z.string().max(40).default(""),
});

export type Brief = z.infer<typeof BriefSchema>;

/** Lit un contenu enregistré (les anciens sites n'ont pas encore de photos). */
export function parseStoredContent(raw: unknown): SiteContent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = StoredContentSchema.safeParse({ photos: [], ...(raw as object) });
  return r.success ? r.data : null;
}
