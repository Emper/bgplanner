import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyManagers } from "@/lib/notifications";
import { eventAttendSchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireEventAccess, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Apuntarse al evento o cambiar de «voy» a «quizás» (y al revés)
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  // Un evento privado no existe para quien no está invitado: a uno privado
  // solo se entra con el enlace de invitación (/api/join-event/[code]).
  const [p, event] = await Promise.all([
    requireEventAccess(eventId, session.userId, "view"),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { maxAttendees: true, _count: { select: { attendees: true } } },
    }),
  ]);

  if (!p.isAttendee && event?.maxAttendees && event._count.attendees >= event.maxAttendees) {
    throw new ApiError(409, "El evento está completo");
  }

  const { status } = await parseBody(request, eventAttendSchema);

  const attendee = await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId, userId: session.userId } },
    update: { status },
    create: { eventId, userId: session.userId, status },
  });

  logActivity("event_joined", session.userId, { eventId, eventName: p.event.name });
  // Solo al apuntarse por primera vez: cambiar de «voy» a «quizás» no avisa
  if (!p.isAttendee) {
    notifyManagers({ eventId }, { type: "event_attendee_joined", actorId: session.userId, metadata: { status } });
  }

  return NextResponse.json(attendee);
});

// Desapuntarse
export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  const p = await requireEventAccess(eventId, session.userId, "view");

  // Quien gestiona el evento (creador o admin) no puede irse: alguien tiene
  // que quedarse al mando. Un admin que quiera irse, que pida que le quiten
  // el rol antes.
  if (p.isAdmin) throw new ApiError(400, "Los admins no pueden desapuntarse del evento");

  await prisma.eventAttendee.deleteMany({
    where: { eventId, userId: session.userId },
  });

  logActivity("event_left", session.userId, { eventId, eventName: p.event.name });

  return NextResponse.json({ deleted: true });
});
