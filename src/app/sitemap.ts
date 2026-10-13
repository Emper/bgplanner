import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// Se genera en cada petición (la consulta es ligera) para que un evento
// nuevo salga en cuanto se crea. Los perfiles no van aquí: son públicos pero
// no los empujamos nosotros a los buscadores.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const events = await prisma.event
    .findMany({
      where: {
        visibility: "public",
        OR: [{ date: { gte: now } }, { endDate: { gte: now } }],
      },
      select: { id: true, updatedAt: true },
      orderBy: { date: "asc" },
      take: 1000,
    })
    .catch(() => []);

  return [
    { url: APP_URL, changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/events`, changeFrequency: "daily", priority: 0.9 },
    ...events.map((e) => ({
      url: `${APP_URL}/events/${e.id}`,
      lastModified: e.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: `${APP_URL}/changelog`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${APP_URL}/roadmap`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${APP_URL}/contact`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
