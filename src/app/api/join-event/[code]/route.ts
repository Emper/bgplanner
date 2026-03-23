import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET — resolve invite code to event info (+ attendance check if logged in)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

  if (!event) {
    return NextResponse.json(
      { error: "Enlace de invitación no válido" },
      { status: 404 }
    );
  }

  let alreadyAttending = false;
  if (session) {
    const attendance = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: session.userId } },
    });
    alreadyAttending = !!attendance;
  }

  return NextResponse.json({
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    eventLocation: event.location,
    attendeeCount: event._count.attendees,
    gameCount: event._count.games,
    alreadyAttending,
  });
}

// POST — auth required: join the event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { code } = await params;

  const event = await prisma.event.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, maxAttendees: true, _count: { select: { attendees: true } } },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Enlace de invitación no válido" },
      { status: 404 }
    );
  }

  // Check if already attending
  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.userId } },
  });

  if (existing) {
    return NextResponse.json({
      alreadyAttending: true,
      eventId: event.id,
      eventName: event.name,
    });
  }

  // Check max attendees
  if (event.maxAttendees && event._count.attendees >= event.maxAttendees) {
    return NextResponse.json({ error: "El evento está completo" }, { status: 409 });
  }

  await prisma.eventAttendee.create({
    data: {
      eventId: event.id,
      userId: session.userId,
      status: "attending",
    },
  });

  return NextResponse.json({
    joined: true,
    eventId: event.id,
    eventName: event.name,
  });
}
