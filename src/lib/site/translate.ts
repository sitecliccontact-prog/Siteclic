import "server-only";
import { ask } from "./generate";
import { SiteContentSchema, type SiteContent } from "./schema";

/** Parties du site traduites (le nom, les photos, le contact et le style ne changent pas). */
export const TranslatedSchema = SiteContentSchema.pick({ brand: true, hero: true, about: true, highlights: true, offer: true, hours: true, closing: true, seo: true });

/** Version anglaise : traduite une seule fois (Sonnet, effort bas ≈ 3 à 5 centimes), puis gardée. */
export async function translateToEnglish(c: SiteContent) {
  const source = TranslatedSchema.parse(c);
  const en = await ask(
    TranslatedSchema,
    "Tu traduis le site d'un commerce français en anglais britannique naturel, élégant et chaleureux, comme une agence haut de gamme. Garde exactement la même structure, le même nombre d'éléments et les prix tels quels. Ne traduis pas le nom du commerce ni les noms propres. Les noms de plats français célèbres peuvent rester en français avec une courte précision en anglais dans la description. Horaires au format anglais (ex. « Tue – Sat », « 12pm – 2:30pm »).",
    `<site>\n${JSON.stringify(source)}\n</site>`,
    "low",
    "eco",
  );
  return { ...en, brand: { ...en.brand, name: c.brand.name } };
}

/** Contenu affiché sur la page anglaise (null si pas encore traduit ou traduction plus valable). */
export function englishContent(c: SiteContent): SiteContent | null {
  const parsed = TranslatedSchema.safeParse(c.translations?.en);
  if (!parsed.success) return null;
  return { ...c, ...parsed.data, brand: { ...parsed.data.brand, name: c.brand.name } };
}
