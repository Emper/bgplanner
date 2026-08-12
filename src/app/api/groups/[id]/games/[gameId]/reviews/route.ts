import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { gameReviewSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// Lista las opiniones de un juego concreto dentro del grupo.
export async function GET(
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
    select: { id: true },
  });
  if (!groupGame) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  const reviews = await prisma.gameReview.findMany({
    where: { groupGameId: groupGame.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
      photos: { orderBy: { order: "asc" }, select: { id: true, url: true } },
      session: { select: { id: true, name: true, date: true } },
    },
  });

  return NextResponse.json({ reviews });
}

// Crea una opinión post-partida para un juego del grupo.
export async function POST(
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
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = gameReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { rating, text, sessionId, photoUrls } = parsed.data;

  // Si se enlaza a una partida, comprobar que es del mismo grupo.
  if (sessionId) {
    const sess = await prisma.gameSession.findFirst({
      where: { id: sessionId, groupId },
      select: { id: true },
    });
    if (!sess) {
      return NextResponse.json({ error: "Partida no válida" }, { status: 400 });
    }
  }

  const review = await prisma.gameReview.create({
    data: {
      groupGameId: groupGame.id,
      userId: session.userId,
      sessionId: sessionId || null,
      rating: rating ?? null,
      text: text?.trim() ? text.trim() : null,
      photos: photoUrls?.length
        ? { create: photoUrls.map((url, i) => ({ url, order: i })) }
        : undefined,
    },
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
      photos: { orderBy: { order: "asc" }, select: { id: true, url: true } },
      session: { select: { id: true, name: true, date: true } },
    },
  });

  // Una opinión implica que el juego se ha jugado: marcar playedAt si no lo estaba.
  if (!groupGame.playedAt) {
    await prisma.groupGame
      .update({ where: { id: groupGame.id }, data: { playedAt: new Date() } })
      .catch(() => {});
  }

  logActivity("game_reviewed", session.userId, {
    groupId,
    gameName: groupGame.game.name,
    rating: rating ?? undefined,
    photoCount: photoUrls?.length ?? 0,
  });

  return NextResponse.json({ review }, { status: 201 });
}
