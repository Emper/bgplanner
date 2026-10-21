import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi perfil · BG Planner",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
