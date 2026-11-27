import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/tableau-de-bord", "/apercu", "/api", "/abonnement", "/auth"] },
    sitemap: "https://siteclic.vercel.app/sitemap.xml",
  };
}
