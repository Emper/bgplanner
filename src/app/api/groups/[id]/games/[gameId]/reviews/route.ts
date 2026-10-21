import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { gameReviewSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { pathFromPublicUrl } from "@/lib/supabaseStorage";

type Ctx = { params: Promise<{ id: string; gameId: string }> };

const REVIEW_INCLUDE = {
  user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
  photos: { orderBy: { order: "asc" }, select: { id: true, url: true } },
} as const;

// Lista las opiniones de un juego concreto dentro del grupo.
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId, gameId } = await params;

  const [, reviews] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.gameReview.findMany({
      where: { groupGame: { groupId, gameId } },
      orderBy: { createdAt: "desc" },
      include: REVIEW_INCLUDE,
    }),
  ]);

  // Sin opiniones puede ser que el juego no esté en el grupo: se distingue.
  if (reviews.length === 0) {
    const exists = await prisma.groupGame.findUnique({
      where: { groupId_gameId: { groupId, gameId } },
      select: { id: true },
    });
    if (!exists) throw new ApiError(404, "Juego no encontrado");
  }

  return NextResponse.json({ reviews });
});

// Crea una opinión post-partida para un juego del grupo.
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId, gameId } = await params;

  const [, groupGame] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.groupGame.findUnique({
      where: { groupId_gameId: { groupId, gameId } },
      include: { game: { select: { name: true } } },
    }),
  ]);
  if (!groupGame) throw new ApiError(404, "Juego no encontrado");

  const { rating, text, photoUrls } = await parseBody(request, gameReviewSchema);

  // Solo fotos subidas a la app (POST /photos), no enlaces a cualquier sitio.
  if (photoUrls?.some((url) => !pathFromPublicUrl(url))) {
    throw new ApiError(400, "Alguna foto no es válida: súbela de nuevo");
  }

  const review = await prisma.gameReview.create({
    data: {
      groupGameId: groupGame.id,
      userId: session.userId,
      rating: rating ?? null,
      text: text?.trim() ? text.trim() : null,
      photos: photoUrls?.length
        ? { create: photoUrls.map((url, i) => ({ url, order: i })) }
        : undefined,
    },
    include: REVIEW_INCLUDE,
  });

  // Una opinión implica que el juego se ha jugado: marcar playedAt si no lo estaba.
  if (!groupGame.playedAt) {
    await prisma.groupGame.update({
      where: { id: groupGame.id },
      data: { playedAt: new Date() },
    });
  }

  logActivity("game_reviewed", session.userId, {
    groupId,
    gameName: groupGame.game.name,
    rating: rating ?? undefined,
    photoCount: photoUrls?.length ?? 0,
  });

  return NextResponse.json({ review }, { status: 201 });
});
