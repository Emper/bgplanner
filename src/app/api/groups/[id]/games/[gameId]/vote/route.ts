import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { voteSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { getGroupType, isVoteValueAllowed } from "@/lib/groupTypes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, gameId } = await params;

  const [membership, group] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.group.findUnique({ where: { id: groupId }, select: { type: true } }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }
  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = voteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { value } = parsed.data;
  const groupType = getGroupType(group.type);

  if (!isVoteValueAllowed(group.type, value)) {
    return NextResponse.json(
      { error: "Ese voto no está disponible en este modo de grupo" },
      { status: 400 }
    );
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

  // Check for existing vote (used to differentiate cast vs change)
  const existingVote = await prisma.vote.findUnique({
    where: {
      groupGameId_userId: {
        groupGameId: groupGame.id,
        userId: session.userId,
      },
    },
  });

  // Apply vote limits configured for this group type
  for (const limit of groupType.voteLimits) {
    if (value !== limit.value) continue;
    const otherVotesWithSameValue = await prisma.vote.findFirst({
      where: {
        userId: session.userId,
        value: limit.value,
        groupGame: { groupId },
        NOT: { groupGameId: groupGame.id },
      },
    });
    // max=1 means: any existing vote with this value on a different game blocks it
    if (otherVotesWithSameValue && limit.max <= 1) {
      return NextResponse.json(
        {
          error: limit.errorMessage,
          conflictingGameId: otherVotesWithSameValue.groupGameId,
        },
        { status: 409 }
      );
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
}

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
      { error: "Juego no encontrado" },
      { status: 404 }
    );
  }

  await prisma.vote.deleteMany({
    where: {
      groupGameId: groupGame.id,
      userId: session.userId,
    },
  });

  logActivity("vote_removed", session.userId, { groupId, gameName: groupGame.game.name });

  return NextResponse.json({ success: true });
}
