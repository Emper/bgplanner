import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEventAdmin } from "@/lib/events";

// Remove game from event (creator or admins)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId, gameId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (!(await isEventAdmin(event, session.userId))) {
    return NextResponse.json({ error: "Solo quien gestiona el evento puede eliminar juegos" }, { status: 403 });
  }

  const eventGame = await prisma.eventGame.findFirst({
    where: { eventId, gameId },
  });
  if (!eventGame) {
    return NextResponse.json({ error: "Juego no encontrado en el evento" }, { status: 404 });
  }
  // Volvería en la siguiente importación: se quita de la lista, en BGG
  if (event.bggGeeklistId && eventGame.fromGeeklist && !eventGame.leftGeeklistAt) {
    return NextResponse.json(
      { error: "Este juego viene de la lista de BGG vinculada: para quitarlo, quítalo de la lista" },
      { status: 409 }
    );
  }

  await prisma.eventGame.delete({ where: { id: eventGame.id } });

  return NextResponse.json({ deleted: true });
}
