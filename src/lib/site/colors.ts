/* Couleurs personnalisées du site : le commerçant choisit 3 couleurs (fond, texte, accent),
   on calcule tout le reste et on garantit que ça reste lisible. Aucun appel à l'IA (gratuit, instantané). */

export type Palette = { bg: string; surface: string; ink: string; muted: string; line: string; accent: string; onAccent: string; band: string; onBand: string };
export type Look = { bg?: string; ink?: string; accent?: string; accent2?: string; relief?: Relief };
export const RELIEFS = ["aucun", "grain", "lueur", "points", "ondes", "profondeur", "marbre"] as const;
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
