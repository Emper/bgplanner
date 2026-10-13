import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Las dos son fuentes variables: sin lista de pesos, Next descarga un único
// fichero por fuente que cubre todos, en vez de uno por cada peso.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

// Solo para cifras y códigos sueltos: que no compita con las otras al cargar.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

export const metadata: Metadata = {
  // Sin esto, las imágenes de las tarjetas de compartir salen con rutas
  // relativas y ningún cliente las sabe resolver.
  metadataBase: new URL(APP_URL),
  title: "BG Planner - Organiza tus juegos de mesa",
  description:
    "Decide qué jugar con tu grupo de amigos votando vuestros juegos de mesa favoritos",
  applicationName: "BG Planner",
  icons: {
    icon: "/favicon.svg",
    // Lo pinta apple-icon.tsx; hay que nombrarlo porque `icons` pisa el
    // enlace que Next pondría solo
    apple: { url: "/apple-icon", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    siteName: "BG Planner",
    locale: "es_ES",
    type: "website",
  },
};

// El color de la barra del navegador en móvil, a juego con el fondo
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#151118" },
  ],
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
