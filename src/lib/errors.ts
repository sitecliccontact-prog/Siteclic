/** Message d'erreur lisible pour le commerçant (jamais « Failed to fetch » en anglais). */
export function friendlyError(e: unknown, fallback: string) {
  const msg = e instanceof Error ? e.message : "";
  if (!msg) return fallback;
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(msg)) {
    return "La connexion Internet a coupé. Vérifiez votre réseau (Wi-Fi ou 4G), puis réessayez.";
  }
  return msg;
}

/** Erreur qui propose de voir les tarifs (limite de l'essai gratuit atteinte). */
export class NeedsOffer extends Error {}
