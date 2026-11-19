import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SiteClic",
    short_name: "SiteClic",
    description: "Ton site en un clic, créé et modifié avec l'IA.",
    start_url: "/tableau-de-bord",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
