import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEventAdmin } from "@/lib/events";
import { GeeklistPendingError } from "@/lib/bgg";
import { syncEventGeeklist } from "@/lib/geeklist";

export const runtime = "nodejs";
export const maxDuration = 300;

// Reimporta ya la lista vinculada (creador o admins)
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
    return NextResponse.json({ error: "Solo quien gestiona el evento puede reimportar la lista" }, { status: 403 });
  }
  if (!event.bggGeeklistId) {
    return NextResponse.json({ error: "Este evento no está vinculado a ninguna lista de BGG" }, { status: 409 });
  }

  try {
    const result = await syncEventGeeklist(eventId, { actorId: session.userId });
    if (!result) {
      return NextResponse.json(
        { error: "La lista se está importando ahora mismo. Espera un minuto y vuelve a probar." },
        { status: 429 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GeeklistPendingError) {
      return NextResponse.json({ pending: true, message: err.message }, { status: 202 });
    }
    const message = err instanceof Error ? err.message : "No se pudo leer la lista de BGG";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
