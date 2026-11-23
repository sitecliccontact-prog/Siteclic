/** Message d'accueil du tableau de bord : change à chaque visite, selon l'heure en France. */

function parisHour(now: Date) {
  return Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(now));
}

export function todayLabel(now = new Date()) {
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function greeting(name: string, now = new Date()) {
  const h = parisHour(now);
  const hello = h >= 5 && h < 12 ? "Bonjour" : h >= 12 && h < 18 ? "Bon après-midi" : "Bonsoir";
  const evening = h >= 18 || h < 5;
  const n = name.trim();

  const titles = n
    ? [
        `${hello}, ${n}`,
        `Alors ${n}, on fait quoi aujourd'hui ?`,
        `Content de vous revoir, ${n}`,
        evening ? `Belle soirée, ${n}` : `Belle journée en vue, ${n}`,
        `On s'y remet, ${n} ?`,
        `Prêt à faire briller ${n} ?`,
      ]
    : [`${hello} !`, "On fait quoi aujourd'hui ?", "Content de vous revoir", evening ? "Belle soirée !" : "Belle journée en vue", "On s'y remet ?"];

  const lines = [
    "Que voulez-vous faire aujourd'hui ?",
    "Votre site vous attend, il n'y a plus qu'à le faire briller.",
    "Une idée ? Dites-la à l'IA, elle s'occupe du reste.",
    "Un nouveau plat, un horaire qui change ? On met ça à jour en un clic.",
    "Vos clients vous cherchent en ligne. Soyons à la hauteur.",
  ];

  const title = pick(titles);
  // Évite de répéter « aujourd'hui » dans le titre et la phrase dessous.
  const line = pick(title.includes("aujourd'hui") ? lines.filter((l) => !l.includes("aujourd'hui")) : lines);
  return { title, line };
}
