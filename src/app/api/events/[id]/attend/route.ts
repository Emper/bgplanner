import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEventAdmin } from "@/lib/events";
import { logActivity } from "@/lib/activity";
import { eventAttendSchema } from "@/lib/validations";

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

  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId: session.userId } },
    select: { id: true },
  });

  if (!existing) {
    // A un evento privado solo se entra con el enlace de invitación
    // (/api/join-event/[code]); por aquí solo los públicos.
    if (event.visibility === "private" && event.createdById !== session.userId) {
      return NextResponse.json({ error: "Este evento es privado: necesitas una invitación" }, { status: 403 });
    }
    if (event.maxAttendees && event._count.attendees >= event.maxAttendees) {
      return NextResponse.json({ error: "El evento está completo" }, { status: 409 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const parsed = eventAttendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { status } = parsed.data;

  const attendee = await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId, userId: session.userId } },
    update: { status },
    create: { eventId, userId: session.userId, status },
  });

  logActivity("event_joined", session.userId, { eventId, eventName: event.name });

  return NextResponse.json(attendee);
}

// Cancel attendance
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  // Quien gestiona el evento (creador o admin) no puede irse: alguien tiene
  // que quedarse al mando. Un admin que quiera irse, que pida que le quiten
  // el rol antes.
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (event && (await isEventAdmin(event, session.userId))) {
    return NextResponse.json({ error: "Los admins no pueden desapuntarse del evento" }, { status: 400 });
  }

  await prisma.eventAttendee.deleteMany({
    where: { eventId, userId: session.userId },
  });

  logActivity("event_left", session.userId, { eventId, eventName: event?.name });

  return NextResponse.json({ deleted: true });
}
