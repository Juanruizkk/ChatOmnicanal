import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { site, siteUrl } from "@/site.config";
import "./globals.css";

// Tipografías autoalojadas: el build no depende de Google Fonts.
const geistSans = localFont({ src: "./fonts/Geist-Variable.woff2", variable: "--font-geist-sans", weight: "100 900" });
const geistMono = localFont({ src: "./fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900" });
// Nunito: redondeada, en línea con el logotipo de PentaBot. Se usa en títulos.
const nunito = localFont({ src: "./fonts/nunito-latin-wght-normal.woff2", variable: "--font-nunito", weight: "200 1000" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.brand} · Atención automática para WhatsApp, Instagram y Messenger`,
    template: `%s · ${site.brand}`,
  },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: site.brand,
    title: `${site.brand} · Atención automática para WhatsApp, Instagram y Messenger`,
    description: site.description,
    url: siteUrl,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
        >
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
