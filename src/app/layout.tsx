import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import MobileChrome from "@/components/MobileChrome";
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

export const metadata: Metadata = {
  title: "BG Planner - Organiza tus juegos de mesa",
  description:
    "Decide qué jugar con tu grupo de amigos votando vuestros juegos de mesa favoritos",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "BG Planner",
    // La barra de estado se pinta sobre el contenido: el color efectivo lo da
    // el propio fondo de la página y lo gestionamos con las áreas seguras.
    statusBarStyle: "black-translucent",
  },
  // Los números de teléfono no se autoenlazan: en iOS los detecta dentro de
  // nombres de juegos y fechas y los pinta en azul.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // El contenido llega hasta los bordes de la pantalla; las áreas seguras las
  // gestionamos nosotros con env(safe-area-inset-*) en globals.css.
  viewportFit: "cover",
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
    <html lang="es" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${bricolage.variable} ${dmSans.variable} ${geistMono.variable} antialiased min-h-screen overflow-x-hidden`}
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <MobileChrome>{children}</MobileChrome>
        <Analytics />
      </body>
    </html>
  );
}
