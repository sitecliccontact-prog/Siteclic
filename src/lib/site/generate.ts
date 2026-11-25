import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { SiteContentSchema, type Brief, type SiteContent } from "./schema";
import type { ImportedSite } from "./importer";
import type { PreparedPhoto } from "./import-photos";

const WRITING_RULES = `Le site doit ressembler au travail d'une vraie agence, jamais à un texte généré par une machine :
- Ton concret, chaleureux, précis. Phrases courtes. Pas de superlatifs creux (« exceptionnel », « inoubliable », « passion », « savoir-faire unique », « au cœur de »), pas d'emojis, pas de points d'exclamation en série.
- Utilise les détails réels du commerce (produits, quartier, histoire) plutôt que des généralités.
- N'invente jamais de faits vérifiables : pas de prix, d'horaires, d'adresse, de téléphone, de récompenses, d'avis clients ou de chiffres absents des informations. Si une information manque, laisse le champ vide ("") plutôt que de l'inventer.
- Écris en français, vouvoiement pour s'adresser aux visiteurs.

Exigences de qualité (le site doit être digne d'une agence parisienne) :
- Titre d'accueil (hero.title) : 4 à 9 mots, une idée forte et propre à CE commerce, jamais une formule passe-partout (« Bienvenue chez… », « Une expérience unique », « L'art de… »).
- Sous-titre : 1 à 2 phrases concrètes (ce qu'on y trouve, où, pour qui).
- eyebrow : « Métier · Ville » en peu de mots.
- about.title : une phrase courte et incarnée ; about.paragraphs : 2 ou 3 paragraphes, le premier est une phrase d'accroche marquante (il s'affiche en grand), les suivants donnent des détails vrais.
- highlights : 3 ou 4 points forts courts et spécifiques (titre de 1 à 3 mots, texte d'une phrase). Pas de banalités (« Accueil chaleureux », « Qualité »).
- Offre : regroupe en catégories claires ; noms des produits tels quels, descriptions courtes et appétissantes seulement si l'information existe.
- Horaires : lignes regroupées et lisibles (« Mardi – Samedi » / « 12h – 14h · 19h – 22h »), « Fermé » pour les jours de fermeture.
- closing : une invitation courte et naturelle, adaptée au métier (réserver, passer, appeler).
- cta : 2 à 3 mots, verbe d'action adapté (« Réserver une table », « Prendre rendez-vous », « Nous appeler »).
- seo : titre « Nom – métier à Ville » et description utile de 140 à 160 caractères.

Thèmes visuels possibles :
- bistrot : vert profond et crème, typographie classique. Restaurants traditionnels, bistrots, caves, épiceries fines.
- atelier : blanc et noir, très graphique et moderne. Coiffeurs, barbiers, boutiques de créateurs, concept stores.
- terracotta : tons chauds ocre et sable. Boulangeries, pâtisseries, cuisine du sud, cafés chaleureux.
- minuit : bleu nuit et or, élégant et feutré. Restaurants gastronomiques, bars à cocktails, instituts de beauté haut de gamme.
- jardin : vert sauge et ivoire, doux et naturel. Fleuristes, bien-être, salons de thé, produits bio.
- riviera : blanc chaux et bleu mer, lumineux. Restaurants de bord de mer, poissonneries, hôtels, cuisine méditerranéenne.
- galerie : blanc et noir très épuré, typographie fine, beaucoup d'espace. Créateurs, galeries, architectes, boutiques design, cafés de spécialité.
- retro : crème et bordeaux, esprit brasserie d'antan. Brasseries, bouchons, bars à vin, pizzerias, crêperies.

Choisis le thème qui correspond le mieux à l'identité du commerce et, s'il y a des photos, à leurs couleurs et à leur ambiance (un thème qui s'accorde avec les photos, pas qui les contredit).`;

export class GenerationError extends Error {}

type UserContent = string | Anthropic.Beta.Messages.BetaContentBlockParam[];

type Effort = "low" | "medium" | "high";

/* Coût : la création (rare) utilise le modèle le plus fort ; les modifications (fréquentes) un modèle 2 fois moins cher. */
type Tier = "fort" | "eco";

export async function ask<T extends z.ZodType>(schema: T, system: string, user: UserContent, effort: Effort = "medium", tier: Tier = "fort"): Promise<z.infer<T>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new GenerationError("La clé de l'IA n'est pas encore configurée.");
  }
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    ...(tier === "fort"
      ? { model: "claude-opus-5-5", betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : { model: "claude-sonnet-5-5" }),
    max_tokens: 16000,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new GenerationError("L'IA n'a pas pu traiter cette demande. Reformulez et réessayez.");
  }
  return response.parsed_output as z.infer<T>;
}

/* ---------- Étape 2 : créer un site à partir du questionnaire ---------- */

function briefToText(b: Brief) {
  const lines = [
    `Métier : ${b.trade}`,
    `Nom du commerce : ${b.name}`,
    b.city && `Ville : ${b.city}`,
    b.address && `Adresse : ${b.address}`,
    b.phone && `Téléphone : ${b.phone}`,
    b.email && `E-mail : ${b.email}`,
    `Ce que nous proposons (avec prix si donnés) :\n${b.offer}`,
    b.hours && `Horaires :\n${b.hours}`,
    b.story && `Notre histoire / ce qui nous rend différents :\n${b.story}`,
    b.specialties && `Nos spécialités / produits phares :\n${b.specialties}`,
    b.since && `Ouvert depuis : ${b.since}`,
    b.audience && `Notre clientèle : ${b.audience}`,
    b.services.length && `Services : ${b.services.join(", ")}`,
    b.payments.length && `Moyens de paiement acceptés : ${b.payments.join(", ")}`,
    b.languages && `Langues parlées : ${b.languages}`,
    b.mood && `Ambiance souhaitée pour le site : ${b.mood}`,
  ];
  return lines.filter(Boolean).join("\n\n");
}

export async function generateSiteContent(brief: Brief): Promise<SiteContent> {
  const content = await ask(
    SiteContentSchema,
    `Tu es directeur de création dans une agence web haut de gamme. Tu écris le contenu du site d'un commerce de proximité à partir des réponses de son propriétaire.\n\n${WRITING_RULES}\n\nTu peux reformuler et mettre en valeur ce que le client a écrit, corriger l'orthographe et regrouper les horaires proprement. Tiens compte de l'ambiance souhaitée. Sers-toi des détails facultatifs quand ils sont donnés : mets les spécialités en avant (points forts, carte), et glisse naturellement les services utiles (terrasse, à emporter, livraison, paiements, langues…) dans les points forts ou les textes, sans en faire une liste. Aucune photo n'est fournie : photos doit être un tableau vide.`,
    `Voici les réponses du propriétaire. Écris le contenu complet de son site.\n\n<reponses>\n${briefToText(brief)}\n</reponses>`,
    "high",
  );
  return { ...content, photos: [] };
}

/* ---------- Étape 3 : améliorer un site existant ---------- */

export async function generateFromImport(site: ImportedSite, photos: PreparedPhoto[]): Promise<SiteContent> {
  const pages = site.pages.map((p) => `<page url="${p.url}">\n${p.text}\n</page>`).join("\n\n");
  const blocks: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  photos.forEach((p, i) => {
    blocks.push({ type: "text", text: `Photo n°${i + 1} (${p.width}×${p.height}) : ${p.url}` });
    blocks.push({ type: "image", source: { type: "base64", media_type: "image/webp", data: p.data.toString("base64") } });
  });
  blocks.push({
    type: "text",
    text: `Voici le contenu du site actuel (${site.url}).\n\nTitre : ${site.title}\nDescription : ${site.description}\n\n${pages}\n\n${photos.length ? `Les ${photos.length} photos ci-dessus viennent de ce site.` : "Aucune photo exploitable n'a été trouvée."}`,
  });
  const content = await ask(
    SiteContentSchema,
    `Tu es directeur de création dans une agence web haut de gamme. Un commerçant te confie son site actuel, vieillissant. Tu en fais une version moderne et élégante, en gardant fidèlement ses informations réelles.\n\n${WRITING_RULES}\n\nRègles pour la reprise :
- Reprends exactement les faits du site actuel : nom, adresse, téléphone, e-mail, horaires, produits, services et prix. Ne change aucun prix ni horaire.
- Réécris les textes pour qu'ils soient plus clairs et plus engageants, sans rien inventer.
- Ignore les mentions légales, cookies, menus de navigation et textes techniques.
- Si la page appartient à une chaîne ou une enseigne à plusieurs adresses, ne décris que CE commerce-ci (son adresse, ses horaires, son téléphone) et ignore les autres boutiques.
- Photos : regarde chaque photo. Garde seulement les belles photos du lieu, des produits, des plats ou de l'équipe, nettes et bien cadrées. Exclus toute image qui contient du texte, des prix, des chiffres, un logo, une affiche, une promotion, un menu photographié, un plan, une capture d'écran ou un montage, ainsi que les images floues ou sombres. Mets en premier la plus belle photo d'ambiance au format paysage (elle s'affiche en très grand en haut du site), puis 2 à 6 autres variées. Recopie les adresses exactement. Tableau vide si aucune ne convient.`,
    blocks,
    "high",
  );
  const allowed = new Set(photos.map((p) => p.url));
  return { ...content, photos: [...new Set(content.photos.filter((u) => allowed.has(u)))].slice(0, 7) };
}

/* ---------- Étape 4 : modifier un site en écrivant à l'IA ---------- */

const EditSchema = z.object({
  reply: z.string().describe("Réponse courte au commerçant (1 à 2 phrases, vouvoiement) qui dit ce qui a été changé, ou pourquoi ce n'est pas possible"),
  content: SiteContentSchema,
});

/** Photos envoyées par les clients (hébergées chez nous) : l'IA peut les regarder. */
function isOwnPhoto(url: string) {
  return /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/photos\//.test(url);
}

export async function editSiteContent(current: SiteContent, instruction: string) {
  const text = `<site_actuel>\n${JSON.stringify(current)}\n</site_actuel>\n\n<demande>\n${instruction}\n</demande>`;
  // Si la demande parle de photos, on montre les photos à l'IA pour qu'elle sache laquelle est laquelle.
  const showPhotos = /photo|image|visuel|en haut|en grand|galerie/i.test(instruction);
  const blocks: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  if (showPhotos) {
    current.photos.forEach((url, i) => {
      if (!isOwnPhoto(url)) return;
      blocks.push({ type: "text", text: `Photo n°${i + 1} (photos[${i}]) : ${url}` });
      blocks.push({ type: "image", source: { type: "url", url } });
    });
  }
  const result = await ask(
    EditSchema,
    `Tu es l'assistant de SiteClic. Un commerçant te demande de modifier son site. Tu reçois le contenu actuel du site en JSON, éventuellement ses photos, et sa demande.\n\nRègles :
- Applique uniquement la demande. Recopie tout le reste à l'identique, mot pour mot.
- Si la demande donne une nouvelle information (horaires, prix, plat, téléphone…), mets-la à jour partout où elle apparaît.
- Photos : la première du tableau photos s'affiche en grand en haut du site, les suivantes dans la galerie. Tu peux changer leur ordre ou en retirer selon la demande, en recopiant les adresses exactement. Tu ne peux pas en inventer : pour en ajouter une, le commerçant utilise le bouton photo (appareil photo) à côté du message.
- Si la demande est floue ou impossible, ne change rien et explique-le gentiment dans reply.
- Pour changer l'ambiance ou les couleurs, choisis le thème le plus proche parmi : bistrot, atelier, terracotta, minuit, jardin, riviera (méditerranée), galerie (minimaliste), retro.\n\n${WRITING_RULES}`,
    blocks.length ? [...blocks, { type: "text", text }] : text,
    "low",
    "eco",
  );
  const allowed = new Set(current.photos);
  return {
    reply: result.reply,
    content: { ...result.content, photos: result.content.photos.filter((u) => allowed.has(u)) },
  };
}

/** Message clair (et sans secret) pour comprendre une panne, affiché au client avec un petit code. */
export function explainError(err: unknown, fallback: string): string {
  if (err instanceof GenerationError) return err.message;
  if (err instanceof Anthropic.APIError) {
    const detail = String((err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message ?? "");
    if (err.status === 401) return "La clé de l'IA est refusée. Il faut la vérifier dans Vercel. (code IA-401)";
    if (/credit balance|billing/i.test(detail)) return "Le crédit de l'IA est épuisé. Il faut en racheter. (code IA-crédit)";
    if (err.status === 429) return "L'IA est très demandée en ce moment. Réessayez dans une minute. (code IA-429)";
    if (err.status && err.status >= 500) return "L'IA est momentanément indisponible. Réessayez dans un instant. (code IA-" + err.status + ")";
    return `${fallback} (code IA-${err.status ?? "?"} : ${detail.slice(0, 180)})`;
  }
  const e = err as { code?: string; message?: string; name?: string } | null;
  if (e && typeof e.code === "string" && typeof e.message === "string") {
    return `${fallback} (code BDD-${e.code} : ${e.message.slice(0, 140)})`;
  }
  return `${fallback} (code ${e?.name ?? "?"} : ${String(e?.message ?? err).slice(0, 140)})`;
}
