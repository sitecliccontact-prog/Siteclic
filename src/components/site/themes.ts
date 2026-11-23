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
  /** Arrondi des photos et cartes, arrondi des boutons. */
  radius: string;
  btnRadius: string;
  /** Boutons en petites capitales espacées (style maison classique). */
  btnCaps: boolean;
  /** Petits ornements (filets, losange) façon carte de restaurant. */
  ornament: boolean;
  /** Mise en page de l'accueil sans photo : centrée (classique) ou alignée à gauche (éditoriale). */
  heroAlign: "center" | "left";
  colors: { bg: string; surface: string; ink: string; muted: string; line: string; accent: string; onAccent: string; band: string; onBand: string };
};

export const THEMES: Record<ThemeName, Theme> = {
  bistrot: {
    fontClasses: `${cormorant.variable} ${inter.variable}`,
    display: "var(--s-display-cormorant)", body: "var(--s-body-inter)",
    displayWeight: 500, displayTracking: "-0.015em",
    radius: "2px", btnRadius: "0px", btnCaps: true, ornament: true, heroAlign: "center",
    colors: { bg: "#10201a", surface: "#162a22", ink: "#efe7d4", muted: "#a9a592", line: "#2a3d35", accent: "#c8a45e", onAccent: "#10201a", band: "#efe7d4", onBand: "#10201a" },
  },
  atelier: {
    fontClasses: `${archivo.variable} ${inter.variable}`,
    display: "var(--s-display-archivo)", body: "var(--s-body-inter)",
    displayWeight: 800, displayTracking: "-0.05em", uppercaseTitles: false,
    radius: "0px", btnRadius: "0px", btnCaps: false, ornament: false, heroAlign: "left",
    colors: { bg: "#ffffff", surface: "#f4f4f2", ink: "#0d0d0d", muted: "#62625e", line: "#e3e3df", accent: "#e63312", onAccent: "#ffffff", band: "#0d0d0d", onBand: "#ffffff" },
  },
  terracotta: {
    fontClasses: `${dmSerif.variable} ${dmSans.variable}`,
    display: "var(--s-display-dmserif)", body: "var(--s-body-dmsans)",
    displayWeight: 400, displayTracking: "-0.025em",
    radius: "6px", btnRadius: "999px", btnCaps: false, ornament: false, heroAlign: "left",
    colors: { bg: "#f5ece0", surface: "#efe2d1", ink: "#3b2416", muted: "#7a5d4a", line: "#e2d0bb", accent: "#bf5b2c", onAccent: "#fff7ef", band: "#3b2416", onBand: "#f5ece0" },
  },
  minuit: {
    fontClasses: `${playfair.variable} ${inter.variable}`,
    display: "var(--s-display-playfair)", body: "var(--s-body-inter)",
    displayWeight: 400, displayTracking: "-0.02em",
    radius: "0px", btnRadius: "0px", btnCaps: true, ornament: true, heroAlign: "center",
    colors: { bg: "#0b0f1a", surface: "#111726", ink: "#ebe4d2", muted: "#9298a8", line: "#20283a", accent: "#c6a66b", onAccent: "#0b0f1a", band: "#ebe4d2", onBand: "#0b0f1a" },
  },
  jardin: {
    fontClasses: `${fraunces.variable} ${outfit.variable}`,
    display: "var(--s-display-fraunces)", body: "var(--s-body-outfit)",
    displayWeight: 400, displayTracking: "-0.03em",
    radius: "20px", btnRadius: "999px", btnCaps: false, ornament: false, heroAlign: "left",
    colors: { bg: "#eef0e7", surface: "#e3e7da", ink: "#1e2a21", muted: "#5d6b5f", line: "#d3d9c7", accent: "#5f7f63", onAccent: "#f6f7f1", band: "#1e2a21", onBand: "#eef0e7" },
  },
};
