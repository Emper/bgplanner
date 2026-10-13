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
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, visibility: true, createdById: true },
  });
  if (!event) return null;

  const isCreator = event.createdById === userId;
  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { role: true },
  });
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

/** ¿Puede este usuario gestionar el evento? Creador o asistente admin. */
export async function isEventAdmin(
  event: { id: string; createdById: string },
  userId: string
): Promise<boolean> {
  if (event.createdById === userId) return true;
  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId: event.id, userId } },
    select: { role: true },
  });
  return attendee?.role === "admin";
}
