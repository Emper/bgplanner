import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geeklistLinkSchema } from "@/lib/validations";
import { isEventAdmin } from "@/lib/events";
import { logActivity } from "@/lib/activity";
import { fetchBggGeeklist, GeeklistPendingError, parseGeeklistId } from "@/lib/bgg";
import { applyGeeklist } from "@/lib/geeklist";

export const runtime = "nodejs";
// La primera vez BGG puede tardar más de un minuto en preparar la lista
export const maxDuration = 300;

// Vincula el evento a una geeklist de BGG e importa sus juegos (creador o admins)
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
    return NextResponse.json({ error: "Solo quien gestiona el evento puede cambiar sus juegos" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = geeklistLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const geeklistId = parseGeeklistId(parsed.data.url);
  if (!geeklistId) {
    return NextResponse.json({ error: "Eso no parece un enlace a una lista de BGG" }, { status: 400 });
  }

  const link = {
    bggGeeklistId: geeklistId,
    geeklistCheckedAt: new Date(),
    ...(event.bggGeeklistId !== geeklistId ? { geeklistTitle: null, geeklistSyncedAt: null } : {}),
  };

  try {
    const list = await fetchBggGeeklist(geeklistId);
    await prisma.event.update({ where: { id: eventId }, data: link });
    const result = await applyGeeklist(eventId, list, session.userId);
    if (event.bggGeeklistId !== geeklistId) {
      logActivity("event_geeklist_linked", session.userId, { eventId, listTitle: list.title, games: result.total });
    }
    return NextResponse.json(result);
  } catch (err) {
    // La lista existe pero BGG aún la prepara: queda vinculada y se importará
    // en cuanto alguien abra el evento (o al pulsar «Reimportar»).
    if (err instanceof GeeklistPendingError) {
      await prisma.event.update({ where: { id: eventId }, data: { ...link, geeklistError: err.message } });
      return NextResponse.json({ pending: true, message: err.message }, { status: 202 });
    }
    const message = err instanceof Error ? err.message : "No se pudo leer la lista de BGG";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Vuelve a los juegos a mano: los que hay se quedan tal cual (creador o admins)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: "Solo quien gestiona el evento puede cambiar sus juegos" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: {
        bggGeeklistId: null,
        geeklistTitle: null,
        geeklistSyncedAt: null,
        geeklistCheckedAt: null,
        geeklistError: null,
      },
    }),
    prisma.eventGame.updateMany({ where: { eventId }, data: { leftGeeklistAt: null } }),
  ]);

  return NextResponse.json({ unlinked: true });
}
