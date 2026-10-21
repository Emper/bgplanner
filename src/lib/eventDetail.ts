import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { refreshGeeklistIfStale } from "@/lib/geeklist";

// Detalle del evento (juegos, asistentes e intereses) tal y como lo ve quien
// llama. Lo usan GET /api/events/[id] y la página de servidor del evento.
// Lanza ApiError 404 si no existe o si es privado y no estás invitado.
export async function getEventDetail(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
      games: {
        // Orden de llegada, estable: es el orden «por defecto» de la pestaña
        orderBy: [{ addedAt: "asc" }, { id: "asc" }],
        include: {
          game: true,
          interests: {
            include: {
              attendee: {
                include: { user: { select: { id: true, name: true, displayName: true, avatarUrl: true } } },
              },
            },
          },
        },
      },
      attendees: {
        // Campos a mano: el enlace de la lista compartida de cada uno no se
        // enseña al resto de asistentes
        select: {
          id: true,
          eventId: true,
          userId: true,
          status: true,
          role: true,
          joinedAt: true,
          user: { select: { id: true, name: true, displayName: true, surname: true, avatarUrl: true, bggUsername: true, slug: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  if (!event) throw new ApiError(404, "Evento no encontrado");

  // Un evento privado no existe para quien no está invitado
  const currentAttendee = event.attendees.find((a) => a.userId === userId);
  const isCreator = event.createdById === userId;
  if (event.visibility === "private" && !isCreator && !currentAttendee) {
    throw new ApiError(404, "Evento no encontrado");
  }

  // Las notas de los intereses son privadas: solo las ve su dueño
  const gamesWithFilteredInterests = event.games.map((eg) => ({
    ...eg,
    interests: eg.interests.map((interest) => ({
      id: interest.id,
      eventGameId: interest.eventGameId,
      attendeeId: interest.attendeeId,
      intensity: interest.intensity,
      notes: interest.attendeeId === currentAttendee?.id ? interest.notes : null,
      // Lo jugado sí se comparte: lo usa "Armar mesa" para bajar lo ya jugado
      playedAt: interest.playedAt,
      userName: interest.attendee.user.displayName || interest.attendee.user.name || "Alguien",
      userId: interest.attendee.user.id,
    })),
  }));

  const isAdmin = isCreator || currentAttendee?.role === "admin";

  // Si toma sus juegos de una lista de BGG, se reimporta después de responder
  refreshGeeklistIfStale(event);

  return {
    ...event,
    // El enlace de invitación solo lo ve quien lo gestiona
    inviteCode: isAdmin ? event.inviteCode : null,
    games: gamesWithFilteredInterests,
    currentUserId: userId,
    isCreator,
    isAdmin,
    currentAttendeeId: currentAttendee?.id || null,
  };
}
