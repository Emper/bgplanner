import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { addGameSchema } from "@/lib/validations";
import { findOrCreateGame } from "@/lib/games";
import { logActivity } from "@/lib/activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  // Run membership check and data fetch in parallel
  const [membership, groupGames] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
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

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const gamesWithScores = groupGames.map((gg) => {
    const score = gg.votes.reduce((acc, v) => acc + v.value, 0);

    const userVote = gg.votes.find((v) => v.userId === session.userId);

    return {
      id: gg.id,
      game: gg.game,
      addedBy: gg.addedBy,
      addedAt: gg.addedAt,
      score,
      voteCount: gg._count.votes,
      userVoteValue: userVote?.value ?? null,
      votes: gg.votes,
    };
  });

  gamesWithScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.game.bggRating || 0) - (a.game.bggRating || 0);
  });

  return NextResponse.json(gamesWithScores);
}

export async function POST(
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

  const body = await request.json();
  const parsed = addGameSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { bggId } = parsed.data;

  const game = await findOrCreateGame(bggId);
  if (!game) {
    return NextResponse.json({ error: "No se pudo obtener datos del juego" }, { status: 502 });
  }

  // Check duplicate — if archived, unarchive instead of error
  const existing = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId: game.id } },
  });

  if (existing) {
    if (existing.archivedAt) {
      // Unarchive: reset to fresh state
      const restored = await prisma.groupGame.update({
        where: { id: existing.id },
        data: { archivedAt: null, playedAt: null },
        include: { game: true },
      });
      logActivity("game_added", session.userId, { groupId, gameName: restored.game.name });
      return NextResponse.json(restored, { status: 200 });
    }
    return NextResponse.json(
      { error: "Este juego ya está en el grupo" },
      { status: 409 }
    );
  }

  // Create the group game and an automatic upvote from the user who added it
  const groupGame = await prisma.groupGame.create({
    data: {
      groupId,
      gameId: game!.id,
      addedById: session.userId,
    },
    include: { game: true },
  });

  await prisma.vote.create({
    data: {
      groupGameId: groupGame.id,
      userId: session.userId,
      value: 1,
    },
  });

  logActivity("game_added", session.userId, { groupId, gameName: game.name });

  return NextResponse.json(groupGame, { status: 201 });
}

// Archive all played games in the group
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const body = await request.json();

  if (body.action !== "archivePlayed") {
    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
    return NextResponse.json({ error: "Solo admins pueden archivar" }, { status: 403 });
  }

  // Find games marked played via completed sessions (manually-marked ones ya llevan playedAt)
  const sessionsWithCompleted = await prisma.gameSessionGame.findMany({
    where: { status: "completed", session: { groupId } },
    select: { gameId: true },
  });
  const completedGameIds = new Set(sessionsWithCompleted.map((sg) => sg.gameId));

  const allPlayedIds = await prisma.groupGame.findMany({
    where: { groupId, archivedAt: null },
    select: { id: true, gameId: true, playedAt: true },
  });

  const toArchive = allPlayedIds.filter(
    (gg) => gg.playedAt !== null || completedGameIds.has(gg.gameId)
  );

  if (toArchive.length > 0) {
    await prisma.groupGame.updateMany({
      where: { id: { in: toArchive.map((gg) => gg.id) } },
      data: { archivedAt: new Date() },
    });
  }

  return NextResponse.json({ archived: toArchive.length });
}
