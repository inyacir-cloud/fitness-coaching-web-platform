import type { Metadata, Viewport } from "next";
import { Oxanium, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import PWAInstall from "@/components/PWAInstall";

const displayFont = Oxanium({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "EmiCoach - Entrenamiento Personal",
  description: "Plataforma de entrenamiento y nutrición personalizada - rutinas, dietas y progreso",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EmiCoach",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#050816",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} bg-[var(--bg)] text-[var(--text)] antialiased`}>
        {children}
        <PWAInstall />
      </body>
    </html>
  );
}
