import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { addGameSchema } from "@/lib/validations";
import { findOrCreateGame } from "@/lib/games";
import { logActivity } from "@/lib/activity";
import { compareRanking, voteScore } from "@/lib/rankingOrder";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  // Membresía y juegos a la vez
  const [, groupGames] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.groupGame.findMany({
      where: { groupId },
      include: {
        game: true,
        addedBy: { select: { name: true, displayName: true } },
        votes: { select: { userId: true, value: true } },
        _count: { select: { votes: true } },
      },
    }),
  ]);

  const gamesWithScores = groupGames.map((gg) => {
    const userVote = gg.votes.find((v) => v.userId === session.userId);
    return {
      id: gg.id,
      game: gg.game,
      addedBy: gg.addedBy,
      addedAt: gg.addedAt,
      score: voteScore(gg.votes),
      voteCount: gg._count.votes,
      userVoteValue: userVote?.value ?? null,
      votes: gg.votes,
    };
  });

  gamesWithScores.sort(compareRanking);

  return NextResponse.json(gamesWithScores);
});

export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  await requireGroupMember(groupId, session.userId);
  const { bggId, name } = await parseBody(request, addGameSchema);

  const game = await findOrCreateGame(bggId, name);
  if (!game) throw new ApiError(502, "No se pudo obtener datos del juego");

  // Si ya estaba pero archivado, se recupera en vez de dar error
  const existing = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId: game.id } },
  });

  if (existing) {
    if (!existing.archivedAt) throw new ApiError(409, "Este juego ya está en el grupo");
    // Desarchivar: vuelve como nuevo
    const restored = await prisma.groupGame.update({
      where: { id: existing.id },
      data: { archivedAt: null, playedAt: null },
      include: { game: true },
    });
    logActivity("game_added", session.userId, { groupId, gameName: restored.game.name });
    return NextResponse.json(restored, { status: 200 });
  }

  // El juego entra con el voto a favor de quien lo añade
  let groupGame;
  try {
    groupGame = await prisma.groupGame.create({
      data: {
        groupId,
        gameId: game.id,
        addedById: session.userId,
        votes: { create: { userId: session.userId, value: 1 } },
      },
      include: { game: true },
    });
  } catch (err) {
    // Dos personas añadiéndolo a la vez: la segunda choca con la primera.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "Este juego ya está en el grupo");
    }
    throw err;
  }

  logActivity("game_added", session.userId, { groupId, gameName: game.name });

  return NextResponse.json(groupGame, { status: 201 });
});
