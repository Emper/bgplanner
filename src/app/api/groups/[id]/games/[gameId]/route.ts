import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { markGroupGamePlayed } from "@/lib/playedGames";

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
}
