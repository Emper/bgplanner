import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

export const metadata: Metadata = {
  // Sin esto, las imágenes de las tarjetas de compartir salen con rutas
  // relativas y ningún cliente las sabe resolver.
  metadataBase: new URL(APP_URL),
  title: "BG Planner - Organiza tus juegos de mesa",
  description:
    "Decide qué jugar con tu grupo de amigos votando vuestros juegos de mesa favoritos",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    siteName: "BG Planner",
    locale: "es_ES",
    type: "website",
  },
};

// Inline script to prevent flash of wrong theme
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="overflow-x-clip">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${bricolage.variable} ${dmSans.variable} ${geistMono.variable} antialiased min-h-screen overflow-x-clip`}
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
