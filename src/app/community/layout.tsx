import type { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

export const metadata: Metadata = {
  title: "Comunidad · BG Planner",
  alternates: { canonical: `${APP_URL}/community` },
  description:
    "Busca gente para jugar, comparte crónicas de tus partidas y resuelve dudas de reglas con otros jugadores de juegos de mesa.",
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
