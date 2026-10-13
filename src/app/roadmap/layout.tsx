import type { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

export const metadata: Metadata = {
  title: "Roadmap · BG Planner",
  description:
    "Lo que viene en BG Planner. Propón ideas y vota las que más te gustaría ver para organizar tus partidas de juegos de mesa.",
  alternates: { canonical: `${APP_URL}/roadmap` },
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
