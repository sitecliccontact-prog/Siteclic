import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { Celebration } from "@/components/Celebration";
import { HelpWidget } from "@/components/HelpWidget";
import { ServiceWorker } from "@/components/ServiceWorker";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({
  variable: "--font-display-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://siteclic.vercel.app"),
  title: "SiteClic · Ton site en un clic",
  description:
    "Créez le site de votre commerce avec l'IA, ou améliorez celui que vous avez déjà. Modifiez-le simplement en écrivant.",
  applicationName: "SiteClic",
  appleWebApp: { capable: true, title: "SiteClic", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "SiteClic",
    title: "SiteClic · L'élégance d'une agence. La simplicité d'un clic.",
    description: "Le site de votre commerce, créé en quelques minutes avec l'IA. Modifiez-le simplement en écrivant ou en parlant.",
    images: ["/icon-512.png"],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${interTight.variable} antialiased`}>
        {children}
        <ServiceWorker />
        <Celebration />
        <HelpWidget />
      </body>
    </html>
  );
}
