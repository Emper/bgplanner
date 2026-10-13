import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addGameSchema } from "@/lib/validations";
import { findOrCreateGame } from "@/lib/games";
import { logActivity } from "@/lib/activity";
import { isEventAdmin } from "@/lib/events";
import { notify } from "@/lib/notifications";

// Add game to event (creator or admins)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (!(await isEventAdmin(event, session.userId))) {
    return NextResponse.json({ error: "Solo quien gestiona el evento puede añadir juegos" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = addGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const game = await findOrCreateGame(parsed.data.bggId, body.name);
  if (!game) {
    return NextResponse.json({ error: "No se pudo obtener datos del juego" }, { status: 502 });
  }

  // Check duplicate
  const existing = await prisma.eventGame.findUnique({
    where: { eventId_gameId: { eventId, gameId: game.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Este juego ya está en el evento" }, { status: 409 });
  }

  const eventGame = await prisma.eventGame.create({
    data: { eventId, gameId: game.id, addedById: session.userId },
    include: { game: true },
  });

  logActivity("event_game_added", session.userId, { eventId, gameName: eventGame.game.name });

  // A quien va (o quizás) le interesa saber qué habrá en la mesa. Varios
  // juegos seguidos se juntan en un solo aviso (ver notify).
  prisma.eventAttendee
    .findMany({
      where: { eventId, status: { not: "cancelled" } },
      select: { userId: true },
    })
    .then((attendees) =>
      notify({
        type: "event_game_added",
        userIds: [event.createdById, ...attendees.map((a) => a.userId)],
        actorId: session.userId,
        eventId,
        metadata: { games: [{ name: eventGame.game.name, thumbnail: eventGame.game.thumbnail }] },
      })
    )
    .catch(() => {});

  return NextResponse.json(eventGame, { status: 201 });
}
