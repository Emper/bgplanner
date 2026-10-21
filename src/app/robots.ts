import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/site";

// Lo público (portada, eventos abiertos, perfiles, changelog…) se indexa.
// Fuera solo lo que es de cada cuenta. Los enlaces para compartir (grupos,
// invitaciones, listas, colecciones) NO van aquí aunque no se indexen: ya
// llevan noindex, y algunos rastreadores de vistas previas (el de X) hacen
// caso a robots.txt y se quedarían sin tarjeta.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/auth/",
          "/login",
          "/profile",
          "/notifications",
          "/collection",
          "/feedback",
          "/events/new",
          "/groups/new",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
