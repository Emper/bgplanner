import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getBlockedUserIds } from "@/lib/moderation";

// Lista todas las opiniones del grupo (para la galería y el feed enriquecido).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  // Las opiniones de personas bloqueadas no se muestran.
  const blockedIds = await getBlockedUserIds(session.userId);

  const reviews = await prisma.gameReview.findMany({
    where: {
      groupGame: { groupId },
      ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
      photos: { orderBy: { order: "asc" }, select: { id: true, url: true } },
      groupGame: {
        select: {
          gameId: true,
          game: { select: { bggId: true, name: true, thumbnail: true } },
        },
      },
      session: { select: { id: true, name: true, date: true } },
    },
  });

  // Aplanamos el juego para que el cliente no tenga que bajar por groupGame.
  const flat = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt,
    userId: r.userId,
    user: r.user,
    photos: r.photos,
    session: r.session,
    game: {
      gameId: r.groupGame.gameId,
      bggId: r.groupGame.game.bggId,
      name: r.groupGame.game.name,
      thumbnail: r.groupGame.game.thumbnail,
    },
  }));

  const response = NextResponse.json({ reviews: flat });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
