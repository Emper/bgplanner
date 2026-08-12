import { prisma } from "./prisma";

export interface EventParticipation {
  event: { id: string; name: string; visibility: string; createdById: string };
  isCreator: boolean;
  isAttendee: boolean;
  canView: boolean;
  canParticipate: boolean;
}

/**
 * Resuelve la relación de un usuario con un evento para controlar acceso.
 * - canView: eventos públicos o si es creador/asistente.
 * - canParticipate: creador o asistente (subir fotos, valorar).
 * Devuelve null si el evento no existe.
 */
export async function getEventParticipation(
  eventId: string,
  userId: string
): Promise<EventParticipation | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, visibility: true, createdById: true },
  });
  if (!event) return null;

  const isCreator = event.createdById === userId;
  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true },
  });
  const isAttendee = !!attendee;

  return {
    event,
    isCreator,
    isAttendee,
    canView: event.visibility === "public" || isCreator || isAttendee,
    canParticipate: isCreator || isAttendee,
  };
}
