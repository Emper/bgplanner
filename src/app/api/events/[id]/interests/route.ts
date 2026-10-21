import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventInterestDeleteSchema, eventInterestSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { isVeto } from "@/lib/intensity";
import { ApiError, apiHandler, parseBody, requireEventAccess, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** La ficha de asistente de quien llama: los intereses cuelgan de ella. */
async function requireAttendee(eventId: string, userId: string) {
  const [, attendee] = await Promise.all([
    requireEventAccess(eventId, userId, "participate"),
    prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    }),
  ]);
  if (!attendee) throw new ApiError(403, "Debes estar apuntado al evento");
  return attendee;
}

// Marcar o cambiar el interés por un juego del evento
export const PUT = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  const attendee = await requireAttendee(eventId, session.userId);
  const { eventGameId, intensity, notes, played } = await parseBody(request, eventInterestSchema);
  const playedAt = played === undefined ? undefined : played ? new Date() : null;

  // El juego tiene que ser de este evento
  const eventGame = await prisma.eventGame.findUnique({
    where: { id: eventGameId },
    include: { game: { select: { name: true } } },
  });
  if (!eventGame || eventGame.eventId !== eventId) {
    throw new ApiError(404, "Juego no encontrado en este evento");
  }

  const interest = await prisma.eventGameInterest.upsert({
    where: { eventGameId_attendeeId: { eventGameId, attendeeId: attendee.id } },
    update: { intensity, notes, playedAt },
    create: { eventGameId, attendeeId: attendee.id, intensity, notes, playedAt },
  });

  // Un veto no es interés: no se anuncia en la actividad del evento
  if (!isVeto(intensity)) {
    logActivity("event_interest_set", session.userId, { eventId, gameName: eventGame.game.name, intensity });
  }

  return NextResponse.json(interest);
});

// Quitar el interés
export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  const attendee = await requireAttendee(eventId, session.userId);
  const { eventGameId } = await parseBody(request, eventInterestDeleteSchema);

  await prisma.eventGameInterest.deleteMany({
    where: { eventGameId, attendeeId: attendee.id },
  });

  return NextResponse.json({ deleted: true });
});
