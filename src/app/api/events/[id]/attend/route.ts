import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Attend event / update attendance status
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { attendees: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  // Check max attendees
  if (event.maxAttendees && event._count.attendees >= event.maxAttendees) {
    // Allow if already attending (status update)
    const existing = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId: session.userId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "El evento está completo" }, { status: 409 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status || "attending";

  const attendee = await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId, userId: session.userId } },
    update: { status },
    create: { eventId, userId: session.userId, status },
  });

  return NextResponse.json(attendee);
}

// Cancel attendance
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  // Don't let creator leave
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (event?.createdById === session.userId) {
    return NextResponse.json({ error: "El gestor no puede desapuntarse de su propio evento" }, { status: 400 });
  }

  await prisma.eventAttendee.deleteMany({
    where: { eventId, userId: session.userId },
  });

  return NextResponse.json({ deleted: true });
}
