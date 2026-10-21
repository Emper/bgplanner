import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { isGroupManager } from "@/lib/groupTypes";
import { groupGamePatchSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { markGroupGamePlayed } from "@/lib/playedGames";

type Ctx = { params: Promise<{ id: string; gameId: string }> };

export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId, gameId } = await params;

  const [membership, groupGame] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.groupGame.findUnique({
      where: { groupId_gameId: { groupId, gameId } },
      include: { game: { select: { name: true } } },
    }),
  ]);

  if (!groupGame) throw new ApiError(404, "Juego no encontrado en este grupo");

  // Solo quien añadió el juego o quien gestiona el grupo
  if (!isGroupManager(membership.role) && groupGame.addedById !== session.userId) {
    throw new ApiError(403, "Solo quien añadió el juego o el admin puede eliminarlo");
  }

  // Borrar el GroupGame se lleva sus votos en cascada
  await prisma.groupGame.delete({
    where: { id: groupGame.id },
  });

  logActivity("game_removed", session.userId, { groupId, gameName: groupGame.game?.name });

  return NextResponse.json({ success: true });
});

// Marcar jugado / devolver a pendientes, o archivar / desarchivar.
export const PATCH = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId, gameId } = await params;
  const { played, archived } = await parseBody(request, groupGamePatchSchema);

  const [, groupGame] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.groupGame.findUnique({
      where: { groupId_gameId: { groupId, gameId } },
      include: { game: { select: { name: true, thumbnail: true } } },
    }),
  ]);

  if (!groupGame) throw new ApiError(404, "Juego no encontrado");

  if (archived !== undefined) {
    await prisma.groupGame.update({
      where: { id: groupGame.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    // El log dice «ocultó»: al desarchivar no hay nada que contar.
    if (archived) {
      logActivity("game_archived", session.userId, { groupId, gameName: groupGame.game.name });
    }
    return NextResponse.json({ success: true });
  }

  // "Devolver al ranking" (played: false) también desarchiva, para que el
  // juego vuelva de verdad al listado de pendientes.
  if (played) {
    await markGroupGamePlayed(groupId, groupGame, session.userId);
  } else {
    await prisma.groupGame.update({
      where: { id: groupGame.id },
      data: { playedAt: null, archivedAt: null },
    });
  }

  logActivity(played ? "game_marked_played" : "game_returned_pending", session.userId, { groupId, gameName: groupGame.game.name });

  return NextResponse.json({ success: true });
});
