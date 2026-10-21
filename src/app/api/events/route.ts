import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEventSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { apiHandler, parseBody, requireSession } from "@/lib/api";

// Eventos que puede ver quien pide: los públicos y los suyos (creados o
// apuntado). ?upcoming=1 → solo los que aún no han empezado (lo que pinta el
// inicio).
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  const upcoming = request.nextUrl.searchParams.get("upcoming") === "1";

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { visibility: "public" },
        { createdById: session.userId },
        { attendees: { some: { userId: session.userId } } },
      ],
      ...(upcoming ? { date: { gte: new Date() } } : {}),
    },
    // Campos a mano: ni la info general (larga) ni el código de invitación,
    // que solo ve quien gestiona el evento, salen en el listado
    select: {
      id: true,
      name: true,
      description: true,
      date: true,
      endDate: true,
      location: true,
      maxAttendees: true,
      // El inicio no pinta carteles, y van incrustados: mejor no mandarlos
      imageUrl: !upcoming,
      visibility: true,
      createdById: true,
      createdBy: { select: { name: true, displayName: true } },
      // Si quien pide va o no
      attendees: { where: { userId: session.userId }, select: { status: true } },
      _count: { select: { attendees: true, games: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(
    events.map(({ attendees, ...e }) => ({ ...e, myStatus: attendees[0]?.status ?? null }))
  );
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
