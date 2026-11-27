/* « Ouvert maintenant » : lit les horaires écrits librement (« Mardi – Samedi », « 12h – 14h · 19h – 22h »)
   et dit si le commerce est ouvert, à l'heure de Paris. Si les horaires sont trop libres pour être lus, on n'affiche rien. */

type Row = { days: string; time: string };
/** Pour chaque jour (0 = dimanche … 6 = samedi) : les plages ouvertes, en minutes depuis minuit. */
export type Week = [number, number][][];

const DAY_WORDS: [RegExp, number][] = [
  [/^(lundi|lun|monday|mon)$/, 1], [/^(mardi|mar|tuesday|tue|tues)$/, 2], [/^(mercredi|mer|wednesday|wed)$/, 3],
  [/^(jeudi|jeu|thursday|thu|thur|thurs)$/, 4], [/^(vendredi|ven|friday|fri)$/, 5], [/^(samedi|sam|saturday|sat)$/, 6],
  [/^(dimanche|dim|sunday|sun)$/, 0],
];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function dayOf(word: string) {
  return DAY_WORDS.find(([re]) => re.test(word))?.[1] ?? null;
}

/** « Mardi – Samedi, dimanche » → [2,3,4,5,6,0] */
export function parseDays(text: string): number[] {
  const t = norm(text);
  if (/tous les jours|7\s*j\s*\/\s*7|7\/7|every ?day|daily/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const part of t.split(/,|;|\bet\b|&|\band\b|\+/)) {
    const tokens = [...part.matchAll(/[a-z]+/g)].map((m) => ({ d: dayOf(m[0]), i: m.index ?? 0 })).filter((x) => x.d !== null) as { d: number; i: number }[];
    if (!tokens.length) continue;
    const between = tokens.length === 2 ? part.slice(tokens[0].i, tokens[1].i) : "";
    if (tokens.length === 2 && /[-–—]|\bau\b|\ba\b|\bto\b|through|until/.test(between)) {
      let d = tokens[0].d;
      for (let n = 0; n < 7; n++) { out.add(d); if (d === tokens[1].d) break; d = (d + 1) % 7; }
    } else tokens.forEach((x) => out.add(x.d));
  }
  return [...out];
}

/** « 12h – 14h30 · 19h – 22h » → [[720, 870], [1140, 1320]] (vide si « Fermé ») */
export function parseTimes(text: string): [number, number][] | null {
  const t = norm(text);
  if (/ferm|closed|repos/.test(t)) return [];
  const out: [number, number][] = [];
  const re = /(\d{1,2})\s*(?:h|:|\.)?\s*(\d{2})?\s*(?:h)?\s*(?:-|–|—|a|à|to|jusqu'?a)\s*(\d{1,2})\s*(?:h|:|\.)?\s*(\d{2})?/g;
  for (const m of t.matchAll(re)) {
    const a = Number(m[1]) * 60 + Number(m[2] ?? 0);
    let b = Number(m[3]) * 60 + Number(m[4] ?? 0);
    if (Number(m[1]) > 24 || Number(m[3]) > 24) continue;
    if (b <= a) b += 24 * 60; // ferme après minuit
    out.push([a, b]);
  }
  return out.length ? out : null;
}

/** Semaine complète, ou null si les horaires ne sont pas lisibles. */
export function parseWeek(rows: Row[]): Week | null {
  const week: Week = [[], [], [], [], [], [], []];
  let understood = 0;
  for (const r of rows) {
    const days = parseDays(r.days);
    const times = parseTimes(r.time);
    if (!days.length || times === null) continue;
    understood++;
    for (const d of days) week[d].push(...times);
  }
  return understood > 0 && understood === rows.length ? week : null;
}

export type OpenState = { open: boolean; soon: boolean; label: string };

const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
};
const DAY_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** État à un instant donné (heure de Paris). */
export function openState(week: Week, now = new Date(), lang: "fr" | "en" = "fr"): OpenState {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const min = Number(get("hour")) * 60 + Number(get("minute"));
  const en = lang === "en";
  // Ouvert ? (plages du jour, ou plage de la veille qui finit après minuit)
  const ranges: [number, number][] = [...week[day], ...week[(day + 6) % 7].map(([a, b]) => [a - 1440, b - 1440] as [number, number])];
  const cur = ranges.find(([a, b]) => min >= a && min < b);
  if (cur) {
    const soon = cur[1] - min <= 45;
    return { open: true, soon, label: en ? `${soon ? "Closing soon" : "Open now"} · until ${fmt(cur[1])}` : `${soon ? "Ferme bientôt" : "Ouvert"} · jusqu'à ${fmt(cur[1])}` };
  }
  // Prochaine ouverture, sur les 7 jours qui viennent.
  for (let k = 0; k < 8; k++) {
    const d = (day + k) % 7;
    const next = week[d].map(([a]) => a).filter((a) => k > 0 || a > min).sort((x, y) => x - y)[0];
    if (next === undefined) continue;
    const when = k === 0 ? (en ? `today at ${fmt(next)}` : `à ${fmt(next)}`)
      : k === 1 ? (en ? `tomorrow at ${fmt(next)}` : `demain à ${fmt(next)}`)
      : en ? `${DAY_EN[d]} at ${fmt(next)}` : `${DAY_FR[d]} à ${fmt(next)}`;
    return { open: false, soon: false, label: en ? `Closed · opens ${when}` : `Fermé · ouvre ${when}` };
  }
  return { open: false, soon: false, label: en ? "Closed" : "Fermé" };
}
