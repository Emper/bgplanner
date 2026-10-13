import type { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

export const metadata: Metadata = {
  title: "Contacto · BG Planner",
  description: "Escríbenos con dudas, ideas o problemas con BG Planner.",
  alternates: { canonical: `${APP_URL}/contact` },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
