/* Couleurs personnalisées du site : le commerçant choisit 3 couleurs (fond, texte, accent),
   on calcule tout le reste et on garantit que ça reste lisible. Aucun appel à l'IA (gratuit, instantané). */

export type Palette = { bg: string; surface: string; ink: string; muted: string; line: string; accent: string; onAccent: string; band: string; onBand: string };
export type Look = { bg?: string; ink?: string; accent?: string; accent2?: string; relief?: Relief; custom?: { label: string; image: string; size?: string } };
export const RELIEFS = ["aucun", "grain", "lin", "lueur", "aurore", "halo", "bokeh", "brume", "soie", "profondeur", "points", "grille", "rayures", "losanges", "damier", "ondes", "vagues", "artdeco", "terrazzo", "marbre", "toile", "pluie", "etoiles", "chevrons", "tartan", "beton", "nuages", "spirale", "rideau", "pois", "horizon", "perso"] as const;
export type Relief = (typeof RELIEFS)[number];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s: unknown): s is string => typeof s === "string" && HEX.test(s);

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
export function hsl(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(255 * f(0), 255 * f(8), 255 * f(4));
}
export function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
export function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
function lum(hex: string) {
  const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const isDark = (hex: string) => lum(hex) < 0.2;

/** Rapproche une couleur de noir ou de blanc jusqu'à atteindre le contraste voulu. */
export function ensureContrast(fg: string, bg: string, min: number) {
  if (contrast(fg, bg) >= min) return fg;
  const target = isDark(bg) ? "#ffffff" : "#000000";
  for (let t = 0.1; t <= 1; t += 0.1) {
    const c = mix(fg, target, t);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

/** Palette complète du site à partir du style choisi + des couleurs du commerçant. Toujours lisible. */
export function applyLook(base: Palette, look?: Look | null): Palette {
  if (!look || (!isHex(look.bg) && !isHex(look.ink) && !isHex(look.accent))) return base;
  const bg = isHex(look.bg) ? look.bg : base.bg;
  const ink = ensureContrast(isHex(look.ink) ? look.ink : base.ink, bg, 7);
  const accent = ensureContrast(isHex(look.accent) ? look.accent : base.accent, bg, 2.2);
  const onAccent = contrast("#ffffff", accent) >= contrast("#111111", accent) ? "#ffffff" : "#111111";
  const band = isDark(bg) ? mix(bg, ink, 0.9) : mix(ink, accent, 0.15);
  return {
    bg, ink, accent, onAccent,
    surface: mix(bg, ink, isDark(bg) ? 0.06 : 0.04),
    muted: ensureContrast(mix(ink, bg, 0.42), bg, 4.5),
    line: mix(bg, ink, 0.14),
    band,
    onBand: contrast("#ffffff", band) >= contrast("#111111", band) ? "#ffffff" : "#111111",
  };
}

/** Note de lisibilité affichée au commerçant. */
export function readability(p: Palette) {
  const t = contrast(p.ink, p.bg), a = contrast(p.accent, p.bg);
  if (t >= 10 && a >= 3) return { label: "Excellente", tone: "ok" as const };
  if (t >= 7 && a >= 2.2) return { label: "Bonne", tone: "ok" as const };
  return { label: "Ajustée automatiquement", tone: "warn" as const };
}

/** Palettes de créateur, choisies à la main pour leur élégance. */
export const CURATED: { name: string; bg: string; ink: string; accent: string; accent2?: string }[] = [
  { name: "Nuit & orange", bg: "#0b0b0d", ink: "#f5f4f0", accent: "#ff5b1f" },
  { name: "Champagne", bg: "#f6f1e7", ink: "#1d1a16", accent: "#b08d57", accent2: "#d9bf8c" },
  { name: "Bleu Riviera", bg: "#f4f7fa", ink: "#0e2233", accent: "#1d5f8c", accent2: "#3fa3c9" },
  { name: "Olive & lin", bg: "#eeece3", ink: "#22261c", accent: "#6b7a3a" },
  { name: "Bordeaux velours", bg: "#1a0d10", ink: "#f3e7e3", accent: "#b4434f", accent2: "#e08a6b" },
  { name: "Lavande de Provence", bg: "#f5f2fa", ink: "#231c33", accent: "#7a5fb0", accent2: "#c49bd8" },
  { name: "Émeraude & or", bg: "#0e1f19", ink: "#eee6d2", accent: "#c9a45c" },
  { name: "Terre cuite", bg: "#f5ece0", ink: "#2b1d14", accent: "#bf5b2c", accent2: "#e39b5a" },
  { name: "Océan profond", bg: "#071723", ink: "#e6f1f6", accent: "#4cc3d9", accent2: "#2f7fd6" },
  { name: "Rose poudré", bg: "#fbf3f1", ink: "#2d1c1f", accent: "#c9707d" },
  { name: "Graphite", bg: "#16181b", ink: "#ecedef", accent: "#a3b1c2" },
  { name: "Citron de Menton", bg: "#fffbea", ink: "#1f1d12", accent: "#c79a00", accent2: "#f2c94c" },
  { name: "Sauge", bg: "#eef1ec", ink: "#1b2420", accent: "#4f7a66" },
  { name: "Coucher de soleil", bg: "#1b1020", ink: "#fbeee6", accent: "#ff7a45", accent2: "#ff3d7f" },
  { name: "Encre & papier", bg: "#fafaf7", ink: "#121212", accent: "#121212" },
  { name: "Menthe glacée", bg: "#f1faf7", ink: "#10241f", accent: "#1f9d82", accent2: "#5fd0b6" },
  { name: "Chocolat", bg: "#211611", ink: "#f2e6da", accent: "#d39b62" },
  { name: "Corail", bg: "#fff6f2", ink: "#2a1712", accent: "#e8553e", accent2: "#ff9a6b" },
  { name: "Minuit doré", bg: "#0d1322", ink: "#eef0f6", accent: "#c8a96a" },
  { name: "Aurore", bg: "#0c0f1d", ink: "#eef0ff", accent: "#7c6cff", accent2: "#29d3c2" },
];

/** « Propose-moi des couleurs » : une palette harmonieuse au hasard (règles des coloristes), toujours lisible. */
export function harmony(seedHue?: number): { name: string; bg: string; ink: string; accent: string; accent2?: string } {
  const h = seedHue ?? Math.random() * 360;
  const dark = Math.random() < 0.45;
  const kinds = [
    { name: "Complémentaire", a: h, a2: h + 180 },
    { name: "Ton sur ton", a: h, a2: h + 30 },
    { name: "Triade", a: h, a2: h + 120 },
    { name: "Accent unique", a: h, a2: undefined },
  ];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  const bg = dark ? hsl(h + 200, 18 + Math.random() * 20, 6 + Math.random() * 5) : hsl(h + 30, 25 + Math.random() * 30, 95 + Math.random() * 3);
  const ink = dark ? hsl(h + 30, 20, 94) : hsl(h + 200, 25, 11);
  const accent = ensureContrast(hsl(k.a, 55 + Math.random() * 30, dark ? 60 : 42), bg, 3);
  const accent2 = k.a2 === undefined ? undefined : hsl(k.a2, 55 + Math.random() * 25, dark ? 62 : 50);
  return { name: k.name, bg, ink, accent, accent2 };
}

/* ---------- Relief du fond : motifs en CSS pur (aucune image à charger), basés sur les couleurs du site ---------- */
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const MARBLE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='700'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='turbulence' baseFrequency='.004 .012' numOctaves='4' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 -1.6 1.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)' opacity='.16'/%3E%3C/svg%3E")`;
const A = (n: number, v = "--accent") => `color-mix(in srgb,var(${v}) ${n}%,transparent)`;
const I = (n: number) => A(n, "--ink");

export const RELIEF_STYLES: Record<Relief, { label: string; image: string; size?: string }> = {
  aucun: { label: "Uni", image: "none" },
  grain: { label: "Papier", image: NOISE },
  lin: { label: "Lin", image: `repeating-linear-gradient(0deg,${I(4)} 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,${I(4)} 0 1px,transparent 1px 4px),${NOISE}` },
  lueur: { label: "Lueur", image: `radial-gradient(70% 50% at 8% 6%,${A(22)},transparent 70%),radial-gradient(60% 50% at 95% 40%,${A(18, "--accent2")},transparent 70%),radial-gradient(70% 50% at 20% 95%,${A(14)},transparent 70%)` },
  aurore: { label: "Aurore", image: `conic-gradient(from 200deg at 70% 0%,${A(16)},${A(14, "--accent2")},transparent 40%,${A(10)} 70%,${A(16)})` },
  halo: { label: "Halo", image: `radial-gradient(55% 38% at 50% 18%,${A(20)},transparent 70%),radial-gradient(90% 60% at 50% 50%,${I(4)},transparent 80%)` },
  bokeh: { label: "Bokeh", image: `radial-gradient(circle at 12% 18%,${A(18)} 0 34px,transparent 36px),radial-gradient(circle at 82% 12%,${A(12, "--accent2")} 0 60px,transparent 62px),radial-gradient(circle at 70% 46%,${A(10)} 0 24px,transparent 26px),radial-gradient(circle at 22% 66%,${A(10, "--accent2")} 0 48px,transparent 50px),radial-gradient(circle at 88% 84%,${A(14)} 0 30px,transparent 32px)`, size: "100% 1400px" },
  brume: { label: "Brume", image: `linear-gradient(180deg,${A(14)},transparent 35%,${A(8, "--accent2")} 70%,transparent)`, size: "100% 1800px" },
  soie: { label: "Soie", image: `linear-gradient(125deg,transparent 20%,${I(5)} 35%,transparent 45%,${I(4)} 62%,transparent 75%)`, size: "100% 1200px" },
  profondeur: { label: "Profondeur", image: `radial-gradient(120% 70% at 50% -10%,${I(9)},transparent 60%),radial-gradient(140% 90% at 50% 120%,color-mix(in srgb,#000 35%,transparent),transparent 60%)` },
  points: { label: "Points", image: `radial-gradient(circle at 1px 1px,${I(16)} 1px,transparent 0)`, size: "22px 22px" },
  grille: { label: "Grille", image: `linear-gradient(${I(7)} 1px,transparent 1px),linear-gradient(90deg,${I(7)} 1px,transparent 1px)`, size: "44px 44px" },
  rayures: { label: "Rayures", image: `repeating-linear-gradient(135deg,${I(4)} 0 1px,transparent 1px 14px)` },
  losanges: { label: "Losanges", image: `linear-gradient(135deg,${I(5)} 25%,transparent 25%),linear-gradient(225deg,${I(5)} 25%,transparent 25%),linear-gradient(45deg,${I(5)} 25%,transparent 25%),linear-gradient(315deg,${I(5)} 25%,transparent 25%)`, size: "40px 40px" },
  damier: { label: "Damier", image: `conic-gradient(${I(4)} 25%,transparent 0 50%,${I(4)} 0 75%,transparent 0)`, size: "56px 56px" },
  ondes: { label: "Ondes", image: `repeating-radial-gradient(circle at 85% -10%,transparent 0 38px,${A(12)} 38px 39px)` },
  vagues: { label: "Vagues", image: `radial-gradient(circle at 50% 100%,transparent 14px,${A(14)} 15px 16px,transparent 17px)`, size: "40px 22px" },
  artdeco: { label: "Art déco", image: `repeating-conic-gradient(from 0deg at 50% 100%,${A(10)} 0 2deg,transparent 2deg 12deg)`, size: "120px 60px" },
  terrazzo: { label: "Terrazzo", image: `radial-gradient(circle at 20% 30%,${A(30)} 0 3px,transparent 4px),radial-gradient(circle at 70% 60%,${A(24, "--accent2")} 0 2px,transparent 3px),radial-gradient(circle at 45% 80%,${I(14)} 0 2.5px,transparent 3.5px),radial-gradient(circle at 85% 20%,${I(10)} 0 4px,transparent 5px)`, size: "90px 90px" },
  marbre: { label: "Marbre", image: MARBLE, size: "700px 700px" },
  toile: { label: "Toile", image: `repeating-linear-gradient(45deg,${I(5)} 0 1px,transparent 1px 6px),repeating-linear-gradient(-45deg,${I(5)} 0 1px,transparent 1px 6px)` },
  pluie: { label: "Pluie", image: `repeating-linear-gradient(100deg,transparent 0 18px,${A(10)} 18px 19px,transparent 19px 31px)` },
  etoiles: { label: "Étoiles", image: `radial-gradient(1.2px 1.2px at 20px 30px,${I(80)},transparent),radial-gradient(1.4px 1.4px at 120px 80px,${I(60)},transparent),radial-gradient(1.5px 1.5px at 70px 150px,${A(90)},transparent),radial-gradient(1.4px 1.4px at 170px 190px,${I(70)},transparent),radial-gradient(1.4px 1.4px at 40px 210px,${I(50)},transparent)`, size: "200px 240px" },
  chevrons: { label: "Chevrons", image: `linear-gradient(135deg,${I(6)} 25%,transparent 25%),linear-gradient(225deg,${I(6)} 25%,transparent 25%)`, size: "40px 20px" },
  tartan: { label: "Tartan", image: `repeating-linear-gradient(0deg,${A(8)} 0 8px,transparent 8px 40px,${I(5)} 40px 42px,transparent 42px 64px),repeating-linear-gradient(90deg,${A(8)} 0 8px,transparent 8px 40px,${I(5)} 40px 42px,transparent 42px 64px)` },
  beton: { label: "Béton", image: `${NOISE},radial-gradient(80% 60% at 30% 20%,${I(6)},transparent 70%),radial-gradient(70% 60% at 80% 80%,${I(5)},transparent 70%)`, size: "160px 160px,100% 100%,100% 100%" },
  nuages: { label: "Nuages", image: `radial-gradient(40% 18% at 20% 12%,${I(7)},transparent 70%),radial-gradient(35% 16% at 78% 30%,${I(6)},transparent 70%),radial-gradient(45% 20% at 35% 62%,${I(6)},transparent 70%),radial-gradient(40% 18% at 85% 85%,${I(7)},transparent 70%)` },
  spirale: { label: "Spirale", image: `repeating-conic-gradient(from 0deg at 100% 0%,${A(9)} 0 3deg,transparent 3deg 9deg)` },
  rideau: { label: "Rideau", image: `repeating-linear-gradient(90deg,transparent 0,${I(6)} 22px,transparent 44px,${I(3)} 66px,transparent 88px)` },
  pois: { label: "Pois", image: `radial-gradient(circle,${A(14)} 0 4px,transparent 5px)`, size: "36px 36px" },
  horizon: { label: "Horizon", image: `linear-gradient(180deg,${A(16)} 0%,transparent 22%,transparent 60%,${A(12, "--accent2")} 85%,${A(18)} 100%)`, size: "100% 1600px" },
  perso: { label: "Mon relief", image: "none" },
};

const BG_WORDS = new Set(["linear-gradient", "radial-gradient", "conic-gradient", "repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient",
  "color-mix", "in", "srgb", "oklab", "var", "--accent", "--accent2", "--ink", "--bg", "accent", "accent2", "ink", "bg", "transparent", "at", "to", "top", "bottom", "left", "right", "center",
  "circle", "ellipse", "closest-side", "closest-corner", "farthest-side", "farthest-corner", "from", "deg", "turn", "px", "em", "rem", "rgb", "rgba", "hsl", "hsla", "auto", "white", "black"]);

/** Vérifie un fond créé par l'IA : uniquement des dégradés et des couleurs (pas d'image externe, pas de code). */
export function safeBackground(css: unknown, max = 2000): string | null {
  if (typeof css !== "string") return null;
  const s = css.trim();
  if (!s || s.length > max || /url|expression|javascript|[@\\;{}<>"'`!]|\/\*/i.test(s)) return null;
  const words = s.replace(/#[0-9a-f]{3,8}\b/gi, " ").match(/-{0,2}[a-z][a-z0-9-]*/gi) ?? [];
  return words.every((w) => BG_WORDS.has(w.toLowerCase())) ? s : null;
}
export function safeSize(css: unknown): string | undefined {
  return typeof css === "string" && /^[\d.\s%a-z,]{1,80}$/i.test(css) && !/[a-z]{5,}/i.test(css.replace(/auto/g, "")) ? css : undefined;
}

/** CSS du relief choisi, appliqué au fond du site. */
export function reliefCss(r: Relief, custom?: Look["custom"]) {
  if (r === "perso") {
    const image = safeBackground(custom?.image);
    const size = safeSize(custom?.size);
    return image ? `.site.rl-perso{background-image:${image}${size ? `;background-size:${size}` : ""}}` : "";
  }
  const st = RELIEF_STYLES[r];
  if (!st || r === "aucun") return "";
  return `.site.rl-${r}{background-image:${st.image}${st.size ? `;background-size:${st.size}` : ""}}`;
}
