import type { Metadata } from "next";

// La página es de cliente: el título de la pestaña sale de aquí.
export const metadata: Metadata = {
  title: "Añadir juegos · BG Planner",
};

export default function AddGamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
