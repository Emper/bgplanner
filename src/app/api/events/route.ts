import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEventSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// List events: public events + events user attends/created
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { visibility: "public" },
        { createdById: session.userId },
        { attendees: { some: { userId: session.userId } } },
      ],
    },
    include: {
      createdBy: { select: { name: true, email: true } },
      attendees: {
        include: { user: { select: { name: true, avatarUrl: true } } },
        take: 5,
      },
      _count: { select: { attendees: true, games: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(events);
}

// Create event
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, description, date, endDate, location, maxAttendees, visibility } = parsed.data;

  const event = await prisma.event.create({
    data: {
      name,
      description,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      location,
      maxAttendees,
      visibility,
      createdById: session.userId,
      // Auto-attend as creator
      attendees: {
        create: { userId: session.userId, status: "attending" },
      },
    },
  });

  logActivity("event_created", session.userId, { eventId: event.id, eventName: parsed.data.name });

  return NextResponse.json(event, { status: 201 });
}
