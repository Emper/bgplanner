import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { voteSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

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

  const body = await request.json();
  const parsed = voteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { type } = parsed.data;

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

  // Check for existing vote before upsert
  const existingVote = await prisma.vote.findUnique({
    where: {
      groupGameId_userId: {
        groupGameId: groupGame.id,
        userId: session.userId,
      },
    },
  });

  // If super vote, check limit (1 per user per group)
  if (type === "super") {
    const existingSuper = await prisma.vote.findFirst({
      where: {
        userId: session.userId,
        type: "super",
        groupGame: { groupId },
        NOT: { groupGameId: groupGame.id },
      },
    });

    if (existingSuper) {
      return NextResponse.json(
        {
          error: "Ya tienes un super voto en este grupo",
          existingSuperGameId: existingSuper.groupGameId,
        },
        { status: 409 }
      );
    }
  }

  // Upsert vote (replace existing vote type)
  const vote = await prisma.vote.upsert({
    where: {
      groupGameId_userId: {
        groupGameId: groupGame.id,
        userId: session.userId,
      },
    },
    update: { type },
    create: {
      groupGameId: groupGame.id,
      userId: session.userId,
      type,
    },
  });

  if (!existingVote) {
    logActivity("vote_cast", session.userId, { groupId, gameName: groupGame.game.name, voteType: type });
  } else if (existingVote.type !== type) {
    logActivity("vote_changed", session.userId, { groupId, gameName: groupGame.game.name, from: existingVote.type, to: type });
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
