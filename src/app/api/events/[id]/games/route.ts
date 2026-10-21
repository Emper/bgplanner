import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addGameSchema } from "@/lib/validations";
import { findOrCreateGame } from "@/lib/games";
import { logActivity } from "@/lib/activity";
import { notifyNow } from "@/lib/notifications";
import { inBackground } from "@/lib/background";
import { ApiError, apiHandler, parseBody, requireEventAccess, requireSession } from "@/lib/api";

// Añadir un juego al evento (creador o admins)
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: eventId } = await params;

    const [p, event] = await Promise.all([
      requireEventAccess(eventId, session.userId, "manage"),
      prisma.event.findUnique({ where: { id: eventId }, select: { bggGeeklistId: true } }),
    ]);

    if (event?.bggGeeklistId) {
      throw new ApiError(
        409,
        "Los juegos de este evento salen de una lista de BGG. Añádelos allí o vuelve a elegirlos a mano."
      );
    }

    const { bggId, name } = await parseBody(request, addGameSchema);

    const game = await findOrCreateGame(bggId, name);
    if (!game) throw new ApiError(502, "No se pudo obtener datos del juego");

    const existing = await prisma.eventGame.findUnique({
      where: { eventId_gameId: { eventId, gameId: game.id } },
      select: { id: true },
    });
    if (existing) throw new ApiError(409, "Este juego ya está en el evento");

    const eventGame = await prisma.eventGame.create({
      data: { eventId, gameId: game.id, addedById: session.userId },
      include: { game: true },
    });

    logActivity("event_game_added", session.userId, { eventId, gameName: eventGame.game.name });

    // A quien va (o quizás) le interesa saber qué habrá en la mesa. Varios
    // juegos seguidos se juntan en un solo aviso (ver notify).
    inBackground(async () => {
      const attendees = await prisma.eventAttendee.findMany({
        where: { eventId, status: { not: "cancelled" } },
        select: { userId: true },
      });
      await notifyNow({
        type: "event_game_added",
        userIds: [p.event.createdById, ...attendees.map((a) => a.userId)],
        actorId: session.userId,
        eventId,
        metadata: { games: [{ name: eventGame.game.name, thumbnail: eventGame.game.thumbnail }] },
      });
    });

    return NextResponse.json(eventGame, { status: 201 });
  }
);
