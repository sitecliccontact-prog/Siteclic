import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SiteContentSchema, type Brief, type SiteContent } from "./schema";

const SYSTEM = `Tu es directeur de création dans une agence web parisienne haut de gamme. Tu écris le contenu du site d'un commerce de proximité (restaurant, boulangerie, coiffeur, fleuriste…) à partir des réponses de son propriétaire.

Le site doit ressembler au travail d'une vraie agence, jamais à un texte généré par une machine :
- Ton concret, chaleureux, précis. Phrases courtes. Pas de superlatifs creux (« exceptionnel », « inoubliable », « passion », « savoir-faire unique », « au cœur de »), pas d'emojis, pas de points d'exclamation en série.
- Utilise les détails réels donnés par le client (produits, quartier, histoire) plutôt que des généralités.
- N'invente jamais de faits vérifiables : pas de prix, d'horaires, d'adresse, de téléphone, de récompenses, d'avis clients ou de chiffres que le client n'a pas donnés. Si une information manque, laisse le champ vide ("") plutôt que de l'inventer.
- Tu peux reformuler et mettre en valeur ce que le client a écrit, corriger l'orthographe et regrouper les horaires proprement.
- Écris en français, vouvoiement pour s'adresser aux visiteurs.

Choix du thème visuel :
- bistrot : vert profond et crème, typographie classique. Restaurants traditionnels, bistrots, caves, épiceries fines.
- atelier : blanc et noir, très graphique et moderne. Coiffeurs, barbiers, boutiques de créateurs, concept stores.
- terracotta : tons chauds ocre et sable. Boulangeries, pâtisseries, cuisine du sud, cafés chaleureux.
- minuit : bleu nuit et or, élégant et feutré. Restaurants gastronomiques, bars à cocktails, instituts de beauté haut de gamme.
- jardin : vert sauge et ivoire, doux et naturel. Fleuristes, bien-être, salons de thé, produits bio.
Tiens compte de l'ambiance souhaitée par le client.`;

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
    b.mood && `Ambiance souhaitée pour le site : ${b.mood}`,
  ];
  return lines.filter(Boolean).join("\n\n");
}

export class GenerationError extends Error {}

export async function generateSiteContent(brief: Brief): Promise<SiteContent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new GenerationError("La clé de l'IA n'est pas encore configurée.");
  }
  const client = new Anthropic();

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(SiteContentSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Voici les réponses du propriétaire. Écris le contenu complet de son site.\n\n<reponses>\n${briefToText(brief)}\n</reponses>`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new GenerationError("L'IA n'a pas pu créer ce site. Réessayez en reformulant vos réponses.");
  }
  return response.parsed_output;
}
