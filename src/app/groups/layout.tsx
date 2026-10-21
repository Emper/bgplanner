import type { Metadata } from "next";

// Título de la pestaña para el listado (página de cliente). Las fichas de
// cada grupo ponen el suyo con generateMetadata.
export const metadata: Metadata = {
  title: "Grupos · BG Planner",
};

export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
