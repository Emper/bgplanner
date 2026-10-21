import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { voteSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { getGroupType, isVoteValueAllowed } from "@/lib/groupTypes";

type Ctx = { params: Promise<{ id: string; gameId: string }> };

export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId, gameId } = await params;

  const [, group, groupGame] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.group.findUnique({ where: { id: groupId }, select: { type: true } }),
    prisma.groupGame.findUnique({
      where: { groupId_gameId: { groupId, gameId } },
      include: {
        game: { select: { name: true } },
        // El voto previo, para distinguir votar de cambiar el voto
        votes: { where: { userId: session.userId }, select: { value: true } },
      },
    }),
  ]);

  if (!group) throw new ApiError(404, "Grupo no encontrado");

  const { value } = await parseBody(request, voteSchema);

  if (!isVoteValueAllowed(group.type, value)) {
    throw new ApiError(400, "Ese voto no está disponible en este modo de grupo");
  }
  if (!groupGame) throw new ApiError(404, "Juego no encontrado en este grupo");

  const existingVote = groupGame.votes[0] ?? null;

  // Límites de votos del tipo de grupo (p. ej. un solo super voto por grupo)
  for (const limit of getGroupType(group.type).voteLimits) {
    if (value !== limit.value) continue;
    const otherVoteWithSameValue = await prisma.vote.findFirst({
      where: {
        userId: session.userId,
        value: limit.value,
        groupGame: { groupId },
        NOT: { groupGameId: groupGame.id },
      },
      select: { groupGameId: true },
    });
    // max=1: cualquier voto igual en otro juego lo bloquea
    if (otherVoteWithSameValue && limit.max <= 1) {
      throw new ApiError(409, limit.errorMessage, {
        conflictingGameId: otherVoteWithSameValue.groupGameId,
      });
    }
  }

  const vote = await prisma.vote.upsert({
    where: {
      groupGameId_userId: {
        groupGameId: groupGame.id,
        userId: session.userId,
      },
    },
    update: { value },
    create: {
      groupGameId: groupGame.id,
      userId: session.userId,
      value,
    },
  });

  if (!existingVote) {
    logActivity("vote_cast", session.userId, { groupId, gameName: groupGame.game.name, voteValue: value });
  } else if (existingVote.value !== value) {
    logActivity("vote_changed", session.userId, { groupId, gameName: groupGame.game.name, fromValue: existingVote.value, toValue: value });
  }

  return NextResponse.json(vote);
});

export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
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

  await prisma.vote.deleteMany({
    where: {
      groupGameId: groupGame.id,
      userId: session.userId,
    },
  });

  logActivity("vote_removed", session.userId, { groupId, gameName: groupGame.game.name });

  return NextResponse.json({ success: true });
});
