import type { Metadata } from "next";

// La página es de cliente: el título de la pestaña sale de aquí.
export const metadata: Metadata = {
  title: "Recomendaciones · BG Planner",
};

export default function RecommendationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
