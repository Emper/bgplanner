import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventInterestSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// Set/update interest for a game
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  // Must be attending
  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId: session.userId } },
  });
  if (!attendee) {
    return NextResponse.json({ error: "Debes estar apuntado al evento" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = eventInterestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { eventGameId, intensity, notes } = parsed.data;

  // Verify the game belongs to this event
  const eventGame = await prisma.eventGame.findUnique({
    where: { id: eventGameId },
    include: { game: { select: { name: true } } },
  });
  if (!eventGame || eventGame.eventId !== eventId) {
    return NextResponse.json({ error: "Juego no encontrado en este evento" }, { status: 404 });
  }

  const interest = await prisma.eventGameInterest.upsert({
    where: { eventGameId_attendeeId: { eventGameId, attendeeId: attendee.id } },
    update: { intensity, notes },
    create: { eventGameId, attendeeId: attendee.id, intensity, notes },
  });

  logActivity("event_interest_set", session.userId, { eventId, gameName: eventGame.game.name, intensity });

  return NextResponse.json(interest);
}

// Remove interest
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId: session.userId } },
  });
  if (!attendee) {
    return NextResponse.json({ error: "Debes estar apuntado al evento" }, { status: 403 });
  }

  const body = await request.json();
  const { eventGameId } = body;

  if (!eventGameId) {
    return NextResponse.json({ error: "eventGameId es obligatorio" }, { status: 400 });
  }

  await prisma.eventGameInterest.deleteMany({
    where: { eventGameId, attendeeId: attendee.id },
  });

  return NextResponse.json({ deleted: true });
}
