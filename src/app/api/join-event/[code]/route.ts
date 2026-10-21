import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyManagers } from "@/lib/notifications";
import { ApiError, apiHandler, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ code: string }> };

const INVALID_LINK = "Enlace de invitación no válido";

// Qué evento hay detrás del enlace (sin sesión también) y, con sesión, si ya
// estás apuntado
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const { code } = await params;

  const [session, event] = await Promise.all([
    getSession(request),
    prisma.event.findUnique({
      where: { inviteCode: code },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        _count: { select: { attendees: true, games: true } },
      },
    }),
  ]);
  if (!event) throw new ApiError(404, INVALID_LINK);

  const attendance = session
    ? await prisma.eventAttendee.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: session.userId } },
        select: { id: true },
      })
    : null;

  return NextResponse.json({
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    eventLocation: event.location,
    attendeeCount: event._count.attendees,
    gameCount: event._count.games,
    alreadyAttending: !!attendance,
  });
});

// Apuntarse al evento con el enlace (la única puerta a los privados)
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { code } = await params;

  const event = await prisma.event.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, maxAttendees: true, _count: { select: { attendees: true } } },
  });
  if (!event) throw new ApiError(404, INVALID_LINK);

  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.userId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ alreadyAttending: true, eventId: event.id, eventName: event.name });
  }

  if (event.maxAttendees && event._count.attendees >= event.maxAttendees) {
    throw new ApiError(409, "El evento está completo");
  }

  await prisma.eventAttendee.create({
    data: { eventId: event.id, userId: session.userId, status: "attending" },
  });

  logActivity("event_joined", session.userId, { eventId: event.id, eventName: event.name });
  notifyManagers(
    { eventId: event.id },
    { type: "event_attendee_joined", actorId: session.userId, metadata: { status: "attending" } }
  );

  return NextResponse.json({ joined: true, eventId: event.id, eventName: event.name });
});
