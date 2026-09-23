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

const SITE_NAME = "BG Planner";
const SITE_TITLE = "BG Planner - Organiza tus juegos de mesa";
const SITE_DESCRIPTION =
  "Decide qué jugar con tu grupo de amigos votando vuestros juegos de mesa favoritos";

export const metadata: Metadata = {
  // Dominio fijo a propósito: NEXT_PUBLIC_APP_URL vale localhost en
  // desarrollo y de ahí saldrían enlaces rotos en las tarjetas que pinta
  // WhatsApp o Telegram al compartir.
  metadataBase: new URL("https://bgplanner.app"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.svg",
  },
  // Sin esto, al pegar un enlace en WhatsApp salía solo el título suelto.
  // Cada página puede afinarlo con su propio `generateMetadata`.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
    <html lang="es" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${bricolage.variable} ${dmSans.variable} ${geistMono.variable} antialiased min-h-screen overflow-x-hidden`}
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
