import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "SiteClic · Ton site en un clic",
  description:
    "Créez le site de votre commerce avec l'IA, ou améliorez celui que vous avez déjà. Modifiez-le simplement en écrivant.",
  applicationName: "SiteClic",
  appleWebApp: { capable: true, title: "SiteClic", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
