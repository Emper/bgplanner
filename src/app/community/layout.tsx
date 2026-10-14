import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comunidad · BG Planner",
  description:
    "Busca gente para jugar, comparte crónicas de tus partidas y resuelve dudas de reglas con otros jugadores de juegos de mesa.",
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
