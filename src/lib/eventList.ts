import { prisma } from "./prisma";

/**
 * Eventos que puede ver alguien: los públicos y los suyos (creados o
 * apuntado). Con `upcoming`, solo los que aún no han empezado (lo que pinta
 * el inicio). La usan GET /api/events y el inicio pintado en el servidor.
 */
export async function listVisibleEvents(userId: string, { upcoming = false }: { upcoming?: boolean } = {}) {
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { visibility: "public" },
        { createdById: userId },
        { attendees: { some: { userId } } },
      ],
      ...(upcoming ? { date: { gte: new Date() } } : {}),
    },
    // Campos a mano: ni la info general (larga) ni el código de invitación,
    // que solo ve quien gestiona el evento, salen en el listado
    select: {
      id: true,
      name: true,
      description: true,
      date: true,
      endDate: true,
      location: true,
      maxAttendees: true,
      // El inicio no pinta carteles, y van incrustados: mejor no mandarlos
      imageUrl: !upcoming,
      visibility: true,
      createdById: true,
      createdBy: { select: { name: true, displayName: true } },
      // Si quien pide va o no
      attendees: { where: { userId }, select: { status: true } },
      _count: { select: { attendees: true, games: true } },
    },
    orderBy: { date: "asc" },
  });

  return events.map(({ attendees, ...e }) => ({ ...e, myStatus: attendees[0]?.status ?? null }));
}
