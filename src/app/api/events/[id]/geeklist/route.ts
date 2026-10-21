import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geeklistLinkSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { fetchBggGeeklist, GeeklistPendingError, parseGeeklistId } from "@/lib/bgg";
import { applyGeeklist, GeeklistUserError } from "@/lib/geeklist";
import { ApiError, apiHandler, parseBody, requireEventAccess, requireSession } from "@/lib/api";

export const runtime = "nodejs";
// La primera vez BGG puede tardar más de un minuto en preparar la lista
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

// Vincula el evento a una geeklist de BGG e importa sus juegos (creador o admins)
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  const [, event] = await Promise.all([
    requireEventAccess(eventId, session.userId, "manage"),
    prisma.event.findUnique({ where: { id: eventId }, select: { bggGeeklistId: true } }),
  ]);

  const { url } = await parseBody(request, geeklistLinkSchema);
  const geeklistId = parseGeeklistId(url);
  if (!geeklistId) throw new ApiError(400, "Eso no parece un enlace a una lista de BGG");

  const isNewList = event?.bggGeeklistId !== geeklistId;
  const link = {
    bggGeeklistId: geeklistId,
    geeklistCheckedAt: new Date(),
    ...(isNewList ? { geeklistTitle: null, geeklistSyncedAt: null } : {}),
  };

  try {
    const list = await fetchBggGeeklist(geeklistId);
    await prisma.event.update({ where: { id: eventId }, data: link });
    const result = await applyGeeklist(eventId, list, session.userId);
    if (isNewList) {
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
    if (err instanceof GeeklistUserError) throw new ApiError(409, err.message);
    console.error("[geeklist] fallo al vincular la lista", geeklistId, err);
    throw new ApiError(502, "No hemos podido leer la lista de BGG. Comprueba el enlace o vuelve a probar en un rato.");
  }
});

// Vuelve a los juegos a mano: los que hay se quedan tal cual (creador o admins)
export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  await requireEventAccess(eventId, session.userId, "manage");

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
});
