import type { Metadata } from "next";

// Páginas de paso para entrar: nada que pintar en un buscador.
export const metadata: Metadata = {
  title: "Entrar · BG Planner",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
