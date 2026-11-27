import type { MetadataRoute } from "next";

const BASE = "https://siteclic.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/inscription`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/cgv`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
