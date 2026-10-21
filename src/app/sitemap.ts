import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/site";

// Se genera en cada petición (la consulta es ligera) para que un evento o un
// hilo de la Comunidad nuevos salgan en cuanto se crean. Los perfiles no van
// aquí: son públicos pero no los empujamos nosotros a los buscadores.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [events, threads] = await Promise.all([
    prisma.event
      .findMany({
        where: {
          visibility: "public",
          OR: [{ date: { gte: now } }, { endDate: { gte: now } }],
        },
        select: { id: true, updatedAt: true },
        orderBy: { date: "asc" },
        take: 1000,
      })
      .catch(() => []),
    // Los hilos de la Comunidad, los más movidos primero.
    prisma.communityThread
      .findMany({
        where: { deletedAt: null },
        select: { id: true, lastActivityAt: true },
        orderBy: { lastActivityAt: "desc" },
        take: 1000,
      })
      .catch(() => []),
  ]);

  return [
    { url: APP_URL, changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/events`, changeFrequency: "daily", priority: 0.9 },
    ...events.map((e) => ({
      url: `${APP_URL}/events/${e.id}`,
      lastModified: e.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: `${APP_URL}/community`, changeFrequency: "daily", priority: 0.8 },
    ...threads.map((t) => ({
      url: `${APP_URL}/community/${t.id}`,
      lastModified: t.lastActivityAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: `${APP_URL}/changelog`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${APP_URL}/roadmap`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${APP_URL}/contact`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${APP_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${APP_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
