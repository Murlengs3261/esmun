import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

// latin-ext no es opcional: "Villalobos-Echeverría" tiene que renderizar
// bien en un gafete impreso.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ESMUN · Colegio Eagles",
  description:
    "Registro de participantes y control de entrega de comida del Modelo de Naciones Unidas del Colegio Eagles.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ESMUN" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}`}>
        {/* Antes de pintar, para que no haya destello del tema equivocado.
            Sin data-theme manda prefers-color-scheme. */}
        <Script id="tema" strategy="beforeInteractive">{`try{var t=localStorage.getItem("esmun.tema");if(t==="claro")document.documentElement.dataset.theme="light";else if(t==="oscuro")document.documentElement.dataset.theme="dark";}catch(e){}`}</Script>
        {children}
      </body>
    </html>
  );
}
