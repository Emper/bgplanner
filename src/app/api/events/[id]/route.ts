import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateEventSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// Get event detail with games, attendees, and current user's interests
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      games: {
        include: {
          game: true,
          interests: {
            include: {
              attendee: {
                include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
              },
            },
          },
        },
      },
      attendees: {
        include: {
          user: { select: { id: true, name: true, surname: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  // Check access for private events
  if (event.visibility === "private") {
    const isCreator = event.createdById === session.userId;
    const isAttendee = event.attendees.some((a) => a.userId === session.userId);
    if (!isCreator && !isAttendee) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
  }

  // Build response: strip private notes from other users' interests
  const currentAttendee = event.attendees.find((a) => a.userId === session.userId);
  const isCreator = event.createdById === session.userId;

  const gamesWithFilteredInterests = event.games.map((eg) => ({
    ...eg,
    interests: eg.interests.map((interest) => ({
      id: interest.id,
      eventGameId: interest.eventGameId,
      attendeeId: interest.attendeeId,
      intensity: interest.intensity,
      // Notes are ALWAYS private — only the owner sees them
      notes: interest.attendeeId === currentAttendee?.id ? interest.notes : null,
      userName: interest.attendee.user.name || interest.attendee.user.email,
      userId: interest.attendee.user.id,
    })),
  }));

  return NextResponse.json({
    ...event,
    games: gamesWithFilteredInterests,
    currentUserId: session.userId,
    isCreator,
    currentAttendeeId: currentAttendee?.id || null,
  });
}

// Update event (creator only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.createdById !== session.userId) {
    return NextResponse.json({ error: "Solo el gestor puede editar el evento" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.date) data.date = new Date(parsed.data.date);
  if (parsed.data.endDate !== undefined) data.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  if (parsed.data.location !== undefined) data.location = parsed.data.location;
  if (parsed.data.maxAttendees !== undefined) data.maxAttendees = parsed.data.maxAttendees;
  if (parsed.data.visibility !== undefined) data.visibility = parsed.data.visibility;

  const updated = await prisma.event.update({ where: { id }, data });

  logActivity("event_updated", session.userId, { eventId: id, eventName: updated.name });

  return NextResponse.json(updated);
}

// Delete event (creator only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.createdById !== session.userId) {
    return NextResponse.json({ error: "Solo el gestor puede eliminar el evento" }, { status: 403 });
  }

  await prisma.event.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
