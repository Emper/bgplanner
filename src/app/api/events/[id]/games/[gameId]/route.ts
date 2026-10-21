import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireEventAccess, requireSession } from "@/lib/api";

// Quitar un juego del evento (creador o admins)
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string; gameId: string }> }) => {
    const session = await requireSession(request);
    const { id: eventId, gameId } = await params;

    const [, event, eventGame] = await Promise.all([
      requireEventAccess(eventId, session.userId, "manage"),
      prisma.event.findUnique({ where: { id: eventId }, select: { bggGeeklistId: true } }),
      prisma.eventGame.findFirst({ where: { eventId, gameId } }),
    ]);

    if (!eventGame) throw new ApiError(404, "Juego no encontrado en el evento");
    // Volvería en la siguiente importación: se quita de la lista, en BGG
    if (event?.bggGeeklistId && eventGame.fromGeeklist && !eventGame.leftGeeklistAt) {
      throw new ApiError(409, "Este juego viene de la lista de BGG vinculada: para quitarlo, quítalo de la lista");
    }

    await prisma.eventGame.delete({ where: { id: eventGame.id } });

    return NextResponse.json({ deleted: true });
  }
);
