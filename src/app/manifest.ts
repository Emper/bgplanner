import type { MetadataRoute } from "next";

// Manifiesto de la PWA. Next lo sirve en /manifest.webmanifest y lo enlaza solo.
// Los mismos iconos alimentan luego a @capacitor/assets para generar los recursos
// nativos de iOS y Android (ver docs/capacitor.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BG Planner",
    short_name: "BG Planner",
    description:
      "Decide qué jugar con tu grupo de amigos votando vuestros juegos de mesa favoritos",
    lang: "es-ES",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#151118",
    theme_color: "#151118",
    categories: ["games", "social", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
