import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEventSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { apiHandler, parseBody, requireSession } from "@/lib/api";
import { listVisibleEvents } from "@/lib/eventList";

// Eventos que puede ver quien pide (ver listVisibleEvents). ?upcoming=1 →
// solo los que aún no han empezado (lo que pinta el inicio).
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const upcoming = request.nextUrl.searchParams.get("upcoming") === "1";
  return NextResponse.json(await listVisibleEvents(session.userId, { upcoming }));
});

// Crear un evento: quien lo crea queda apuntado
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { name, description, about, date, endDate, location, maxAttendees, visibility, imageUrl } =
    await parseBody(request, createEventSchema);

  const event = await prisma.event.create({
    data: {
      name,
      description,
      about: about || null,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      location,
      maxAttendees,
      visibility,
      imageUrl: imageUrl && !imageUrl.startsWith("/api/img/") ? imageUrl : null,
      createdById: session.userId,
      attendees: {
        create: { userId: session.userId, status: "attending" },
      },
    },
  });

  logActivity("event_created", session.userId, { eventId: event.id, eventName: name });

  return NextResponse.json(event, { status: 201 });
});
