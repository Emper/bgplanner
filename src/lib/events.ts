import { prisma } from "./prisma";

export interface EventParticipation {
  event: { id: string; name: string; visibility: string; createdById: string };
  isCreator: boolean;
  /** Creador o asistente con rol admin: puede gestionar el evento. */
  isAdmin: boolean;
  isAttendee: boolean;
  canView: boolean;
  canParticipate: boolean;
}

/**
 * Resuelve la relación de un usuario con un evento para controlar acceso.
 * - canView: eventos públicos o si es creador/asistente.
 * - canParticipate: creador o asistente (subir fotos, valorar).
 * - isAdmin: creador o admin (editar, juegos, invitación, moderar fotos).
 * Devuelve null si el evento no existe.
 */
export async function getEventParticipation(
  eventId: string,
  userId: string
): Promise<EventParticipation | null> {
  const [event, attendee] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, visibility: true, createdById: true },
    }),
    prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { role: true },
    }),
  ]);
  if (!event) return null;

  const isCreator = event.createdById === userId;
  const isAttendee = !!attendee;

  return {
    event,
    isCreator,
    isAdmin: isCreator || attendee?.role === "admin",
    isAttendee,
    canView: event.visibility === "public" || isCreator || isAttendee,
    canParticipate: isCreator || isAttendee,
  };
}

