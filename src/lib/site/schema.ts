import { z } from "zod";
import { RELIEFS } from "./colors";

/** Les styles visuels disponibles pour les sites des clients. */
export const THEMES = ["bistrot", "atelier", "terracotta", "minuit", "jardin", "riviera", "galerie", "retro"] as const;
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
  booking: z.object({
    enabled: z.boolean(),
    /** Garantie contre les absences : empreinte bancaire (rien n'est débité) ou acompte, montant par personne en euros.
        account = compte Stripe du restaurant (vérifié par le serveur). */
    pay: z.object({
      mode: z.enum(["aucun", "empreinte", "acompte"]),
      perPerson: z.number().min(0).max(500),
      account: z.string().max(60).optional(),
    }).optional(),
  }).optional(),
  /** Assistant IA qui répond aux visiteurs (texte et voix). */
  assistant: z.object({
    enabled: z.boolean(),
    /** Ce que le commerçant veut que l'assistant sache en plus (allergènes, parking, groupes…). */
    notes: z.string().max(3000).default(""),
    /** Voix de l'assistant au téléphone. */
    voice: z.enum(["homme", "femme"]).default("femme"),
  }).optional(),
  /** Plan de salle : le visiteur choisit sa table en réservant (positions en % du plan). */
  floor: z.object({
    enabled: z.boolean(),
    tables: z.array(z.object({
      id: z.string().max(20),
      label: z.string().max(20),
      seats: z.number().int().min(1).max(20),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      shape: z.enum(["rond", "carre", "long"]),
      zone: z.string().max(30).default(""),
    })).max(60),
  }).optional(),
  /** Couleurs choisies par le commerçant (par-dessus le style) et relief du fond. */
  look: z.object({
    bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    ink: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    accent2: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    relief: z.enum(RELIEFS).optional(),
    /** Relief créé par l'IA à la demande du commerçant (dégradés CSS vérifiés). */
    custom: z.object({ label: z.string().max(40), image: z.string().max(2000), size: z.string().max(80).optional() }).optional(),
  }).optional(),
  /** Avis clients affichés sur le site + lien pour laisser un avis Google. */
  reviews: z.object({
    googleUrl: z.string().max(400).default(""),
    items: z.array(z.object({ name: z.string().max(60), text: z.string().max(400), stars: z.number().int().min(1).max(5) })).max(12).default([]),
  }).optional(),
  /** Version anglaise du site (traduite une fois par l'IA, gardée). */
  translations: z.object({ en: z.unknown().optional(), enAt: z.string().optional() }).optional(),
  /** Commande à emporter (click & collect). */
  order: z.object({ enabled: z.boolean(), online: z.boolean().default(false), account: z.string().max(60).optional() }).optional(),
  /** Cartes cadeaux à acheter en ligne. */
  gift: z.object({ enabled: z.boolean(), amounts: z.array(z.number().int().min(10).max(500)).max(5).default([30, 50, 100]), account: z.string().max(60).optional() }).optional(),
  /** Réseaux sociaux, affichés en bas du site. */
  links: z.object({ instagram: z.string().max(200), facebook: z.string().max(200) }).partial().optional(),
  /** Vidéo de présentation : celle du commerçant (url) ou, sans url, un petit film animé fait à partir de ses photos. */
  video: z.object({
    enabled: z.boolean(),
    url: z.string().max(400).default(""),
    /** Petits clips (5 secondes environ) montés automatiquement en film. */
    clips: z.array(z.string().max(400)).max(5).default([]),
  }).optional(),
});

/** Contenu enregistré = contenu écrit par l'IA + réglages du commerçant. */
export const StoredContentSchema = SiteContentSchema.extend(SiteExtrasSchema.shape);

export type SiteContent = z.infer<typeof StoredContentSchema>;
export type SiteExtras = z.infer<typeof SiteExtrasSchema>;

/** Garde les réglages du commerçant quand l'IA réécrit le site. */
export function keepExtras(from: SiteContent, to: SiteContent): SiteContent {
  return { ...to, special: from.special, booking: from.booking, assistant: from.assistant, links: from.links, video: from.video, floor: from.floor, look: from.look, reviews: from.reviews, translations: from.translations, order: from.order, gift: from.gift };
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
  // Détails facultatifs (questionnaire « Plus de détails »)
  specialties: z.string().max(1500).default(""),
  services: z.array(z.string().max(40)).max(20).default([]),
  payments: z.array(z.string().max(40)).max(10).default([]),
  audience: z.string().max(300).default(""),
  since: z.string().max(40).default(""),
  languages: z.string().max(120).default(""),
  instagram: z.string().max(200).default(""),
  facebook: z.string().max(200).default(""),
  // Vidéo de présentation : "non", "auto" (film fait par SiteClic avec les photos et videoClips) ou "perso" (videoUrl envoyée)
  video: z.enum(["non", "auto", "perso"]).default("non"),
  videoUrl: z.string().max(400).default(""),
  videoClips: z.array(z.string().max(400)).max(5).default([]),
});

export type Brief = z.infer<typeof BriefSchema>;

/** Lit un contenu enregistré (les anciens sites n'ont pas encore de photos). */
export function parseStoredContent(raw: unknown): SiteContent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = StoredContentSchema.safeParse({ photos: [], ...(raw as object) });
  return r.success ? r.data : null;
}

/** Transforme « @moncompte » ou une adresse incomplète en lien Instagram / Facebook. */
export function socialUrl(kind: "instagram" | "facebook", raw: string | undefined) {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.)?(instagram|facebook)\.com\//i.test(v)) return `https://${v.replace(/^www\./i, "")}`;
  const handle = v.replace(/^@/, "").replace(/[^\w.-]/g, "");
  return handle ? `https://${kind}.com/${handle}` : null;
}

/** Adresse d'une vidéo hébergée chez nous (on n'accepte que celles-là). */
export function isOwnVideo(url: string) {
  return /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/videos\/[\w./-]+$/.test(url);
}

export type FloorTable = NonNullable<SiteContent["floor"]>["tables"][number];

/** Prix lu dans le texte de la carte (« 12 € », « 12,50€ », « 9.90 ») → centimes, ou null. */
export function priceCents(price: string): number | null {
  const m = price.replace(/\s/g, "").match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const v = Math.round(parseFloat(m[1].replace(",", ".")) * 100);
  return v > 0 && v < 100000 ? v : null;
}
