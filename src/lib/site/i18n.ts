/* Textes fixes des sites clients en anglais (le contenu lui-même est traduit une fois par l'IA). */
export type Lang = "fr" | "en";

const EN: Record<string, string> = {
  "La maison": "About us",
  "Infos pratiques": "Visit us",
  "Adresse": "Address",
  "Horaires": "Opening hours",
  "Téléphone": "Phone",
  "Réserver une table": "Book a table",
  "En images": "In pictures",
  "Venir nous voir": "Come and see us",
  "Itinéraire": "Directions",
  "Contact": "Contact",
  "Réserver": "Book",
  "Appeler": "Call",
  "Aujourd'hui": "Today",
  "Ils en parlent": "What our guests say",
  "Laisser un avis Google": "Leave a Google review",
  "Commander à emporter": "Order for pickup",
  "Offrir une carte cadeau": "Give a gift card",
  "Réservation": "Booking",
  "Date": "Date",
  "Heure": "Time",
  "Personnes": "Guests",
  "Nom": "Name",
  "Message": "Message",
  "(facultatif)": "(optional)",
  "Envoyer la demande": "Send request",
  "ou remplissez le formulaire": "or fill in the form",
  "Le restaurant vous rappelle pour confirmer.": "The restaurant will call you back to confirm.",
  "Fermer": "Close",
  "Envoi…": "Sending…",
  "Votre table": "Your table",
  "Libre": "Free",
  "Votre choix": "Your choice",
  "Réservée": "Booked",
  "Touchez une table sur le plan, ou laissez-nous choisir.": "Tap a table on the plan, or let us choose.",
  "Réserver en parlant à l'IA": "Book by talking to our AI",
  "Notre assistant vous répond à voix haute": "Our assistant answers out loud",
};

export function tr(lang: Lang | undefined, fr: string) {
  return lang === "en" ? EN[fr] ?? fr : fr;
}
