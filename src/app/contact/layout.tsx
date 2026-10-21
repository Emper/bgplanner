import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contacto · BG Planner",
  description: "Escríbenos con dudas, ideas o problemas con BG Planner.",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
