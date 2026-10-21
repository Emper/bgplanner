import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GeeklistPendingError } from "@/lib/bgg";
import { GeeklistUserError, syncEventGeeklist } from "@/lib/geeklist";
import { ApiError, apiHandler, requireEventAccess, requireSession } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300;

// Reimporta ya la lista vinculada (creador o admins)
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: eventId } = await params;

    const [, event] = await Promise.all([
      requireEventAccess(eventId, session.userId, "manage"),
      prisma.event.findUnique({ where: { id: eventId }, select: { bggGeeklistId: true } }),
    ]);
    if (!event?.bggGeeklistId) {
      throw new ApiError(409, "Este evento no está vinculado a ninguna lista de BGG");
    }

    let result: Awaited<ReturnType<typeof syncEventGeeklist>>;
    try {
      result = await syncEventGeeklist(eventId, { actorId: session.userId });
    } catch (err) {
      if (err instanceof GeeklistPendingError) {
        return NextResponse.json({ pending: true, message: err.message }, { status: 202 });
      }
      if (err instanceof GeeklistUserError) throw new ApiError(409, err.message);
      console.error("[geeklist] fallo al reimportar la lista del evento", eventId, err);
      throw new ApiError(502, "No hemos podido leer la lista de BGG. Vuelve a probar en un rato.");
    }
    if (!result) {
      throw new ApiError(429, "La lista se está importando ahora mismo. Espera un minuto y vuelve a probar.");
    }
    return NextResponse.json(result);
  }
);
