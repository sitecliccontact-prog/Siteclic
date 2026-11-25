import type { ThemeName } from "./schema";

/** Ambiances proposées à la création. Chacune correspond à un style de site précis. */
export const MOODS: { id: string; label: string; hint: string; theme: ThemeName }[] = [
  { id: "Chaleureux et convivial", label: "Chaleureux", hint: "Accueillant, familial", theme: "terracotta" },
  { id: "Chic et raffiné", label: "Chic", hint: "Élégant, classique", theme: "bistrot" },
  { id: "Moderne et graphique", label: "Moderne", hint: "Net, audacieux", theme: "atelier" },
  { id: "Naturel et doux", label: "Naturel", hint: "Simple, apaisant", theme: "jardin" },
  { id: "Luxe et feutré", label: "Luxe", hint: "Nuit, or, intime", theme: "minuit" },
  { id: "Méditerranée lumineuse", label: "Méditerranée", hint: "Blanc, bleu mer", theme: "riviera" },
  { id: "Minimaliste et épuré", label: "Minimaliste", hint: "Espace, finesse", theme: "galerie" },
  { id: "Rétro, esprit brasserie", label: "Rétro", hint: "Crème, bordeaux", theme: "retro" },
];

export function moodTheme(mood: string): ThemeName | null {
  return MOODS.find((m) => m.id === mood)?.theme ?? null;
}
