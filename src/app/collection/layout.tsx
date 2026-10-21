import type { Metadata } from "next";

// La página es de cliente: el título de la pestaña sale de aquí.
export const metadata: Metadata = {
  title: "Mi colección · BG Planner",
};

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
