import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BG Planner",
    short_name: "BG Planner",
    description: "Decide con tus amigos a qué jugar: colecciones de BGG, votaciones, ranking y eventos.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#151118",
    theme_color: "#151118",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
