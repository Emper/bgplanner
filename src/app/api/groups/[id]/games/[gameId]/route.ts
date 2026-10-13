import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { getGroupType } from "@/lib/groupTypes";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, gameId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const groupGame = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId } },
    include: { game: { select: { name: true } } },
  });

  if (!groupGame) {
    return NextResponse.json(
      { error: "Juego no encontrado en este grupo" },
      { status: 404 }
    );
  }

  // Only the user who added the game or a group admin can delete it
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  const isOwner = groupGame.addedById === session.userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Solo quien añadió el juego o el admin puede eliminarlo" },
      { status: 403 }
    );
  }

  // Deleting GroupGame cascades to votes (onDelete: Cascade on Vote)
  await prisma.groupGame.delete({
    where: { id: groupGame.id },
  });

  logActivity("game_removed", session.userId, { groupId, gameName: groupGame.game?.name });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, gameId } = await params;
  const body = await request.json();
  const { played, archived } = body;

  if (typeof played !== "boolean" && typeof archived !== "boolean") {
    return NextResponse.json({ error: "Campo 'played' o 'archived' requerido (boolean)" }, { status: 400 });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const groupGame = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId } },
    include: { game: { select: { name: true, thumbnail: true } } },
  });

  if (!groupGame) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  // Handle archive
  if (typeof archived === "boolean") {
    await prisma.groupGame.update({
      where: { id: groupGame.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    logActivity("game_archived", session.userId, { groupId, gameName: groupGame.game.name });
    return NextResponse.json({ success: true });
  }

  // Update playedAt. "Devolver al ranking" (played: false) también desarchiva,
  // para que el juego vuelva de verdad al listado de pendientes.
  await prisma.groupGame.update({
    where: { id: groupGame.id },
    data: played
      ? { playedAt: new Date() }
      : { playedAt: null, archivedAt: null },
  });

  // When marking as played, free up votes that are slot-limited by the group type
  // (e.g. the super vote in "friends" mode). Modes without limits keep their
  // votes intact — nadie está "esperando" su slot.
  if (played) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true, type: true },
    });
    const limitedValues = getGroupType(group?.type)
      .voteLimits.filter((l) => l.max <= 1)
      .map((l) => l.value);

    const superVotes = limitedValues.length
      ? await prisma.vote.findMany({
          where: { groupGameId: groupGame.id, value: { in: limitedValues } },
          select: { userId: true },
        })
      : [];

    if (superVotes.length > 0) {
      await prisma.vote.updateMany({
        where: { groupGameId: groupGame.id, value: { in: limitedValues } },
        data: { value: 1 },
      });

      notify({
        type: "super_vote_freed",
        userIds: superVotes.map((v) => v.userId),
        actorId: session.userId,
        groupId,
        metadata: { gameName: groupGame.game.name, thumbnail: groupGame.game.thumbnail ?? null },
      });
    }

    // Solo en la transición pendiente → jugado (evita re-disparar al re-marcar).
    // La invitación a opinar NO se manda aquí: la deja el cron diario en la
    // campana ("valora los juegos de ayer"), uno por grupo y no uno por juego.
    if (!groupGame.playedAt) {
      // Las notas de ranking ("por qué propongo este juego") pierden sentido
      // una vez jugado: soft-delete de TODAS las del juego en el grupo.
      await prisma.gameComment.updateMany({
        where: { groupGameId: groupGame.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }
  }

  logActivity(played ? "game_marked_played" : "game_returned_pending", session.userId, { groupId, gameName: groupGame.game.name });

  return NextResponse.json({ success: true });
}
