/** « vendredi 12 décembre » (date AAAA-MM-JJ). */
export function dateLong(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}
