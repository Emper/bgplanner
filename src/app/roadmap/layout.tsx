import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Roadmap · BG Planner",
  description:
    "Lo que viene en BG Planner. Propón ideas y vota las que más te gustaría ver para organizar tus partidas de juegos de mesa.",
  alternates: { canonical: absoluteUrl("/roadmap") },
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
