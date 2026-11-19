import { Archivo, Cormorant_Garamond, DM_Sans, DM_Serif_Display, Fraunces, Inter, Outfit, Playfair_Display } from "next/font/google";
import type { ThemeName } from "@/lib/site/schema";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--s-display-cormorant" });
const archivo = Archivo({ subsets: ["latin"], weight: ["500", "700", "800", "900"], variable: "--s-display-archivo" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: ["400"], style: ["normal", "italic"], variable: "--s-display-dmserif" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--s-display-playfair" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--s-display-fraunces" });
const inter = Inter({ subsets: ["latin"], variable: "--s-body-inter" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--s-body-dmsans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--s-body-outfit" });

export type Theme = {
  fontClasses: string;
  display: string;
  body: string;
  displayWeight: number;
  displayTracking: string;
  uppercaseTitles?: boolean;
  colors: { bg: string; surface: string; ink: string; muted: string; line: string; accent: string; onAccent: string; band: string; onBand: string };
};

export const THEMES: Record<ThemeName, Theme> = {
  bistrot: {
    fontClasses: `${cormorant.variable} ${inter.variable}`,
    display: "var(--s-display-cormorant)", body: "var(--s-body-inter)",
    displayWeight: 600, displayTracking: "-0.01em",
    colors: { bg: "#13261f", surface: "#1a3129", ink: "#f2ead8", muted: "#b9b29f", line: "#2c4339", accent: "#c9a45c", onAccent: "#13261f", band: "#f2ead8", onBand: "#13261f" },
  },
  atelier: {
    fontClasses: `${archivo.variable} ${inter.variable}`,
    display: "var(--s-display-archivo)", body: "var(--s-body-inter)",
    displayWeight: 900, displayTracking: "-0.045em", uppercaseTitles: false,
    colors: { bg: "#ffffff", surface: "#f4f4f2", ink: "#0d0d0d", muted: "#62625e", line: "#e3e3df", accent: "#e63312", onAccent: "#ffffff", band: "#0d0d0d", onBand: "#ffffff" },
  },
  terracotta: {
    fontClasses: `${dmSerif.variable} ${dmSans.variable}`,
    display: "var(--s-display-dmserif)", body: "var(--s-body-dmsans)",
    displayWeight: 400, displayTracking: "-0.02em",
    colors: { bg: "#f5ece0", surface: "#efe2d1", ink: "#3b2416", muted: "#7a5d4a", line: "#e2d0bb", accent: "#bf5b2c", onAccent: "#fff7ef", band: "#3b2416", onBand: "#f5ece0" },
  },
  minuit: {
    fontClasses: `${playfair.variable} ${inter.variable}`,
    display: "var(--s-display-playfair)", body: "var(--s-body-inter)",
    displayWeight: 500, displayTracking: "-0.015em",
    colors: { bg: "#0d1322", surface: "#141b2e", ink: "#ece5d3", muted: "#9da3b4", line: "#232b40", accent: "#c8a96a", onAccent: "#0d1322", band: "#c8a96a", onBand: "#0d1322" },
  },
  jardin: {
    fontClasses: `${fraunces.variable} ${outfit.variable}`,
    display: "var(--s-display-fraunces)", body: "var(--s-body-outfit)",
    displayWeight: 400, displayTracking: "-0.025em",
    colors: { bg: "#eef0e7", surface: "#e3e7da", ink: "#1e2a21", muted: "#5d6b5f", line: "#d3d9c7", accent: "#5f7f63", onAccent: "#f6f7f1", band: "#1e2a21", onBand: "#eef0e7" },
  },
};
