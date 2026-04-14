import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
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
  const [membership, sessions] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.gameSession.findMany({
      where: { groupId },
      orderBy: { date: "desc" },
      include: {
        createdBy: { select: { name: true, displayName: true } },
        games: {
          orderBy: { order: "asc" },
          include: {
            game: {
              select: {
                id: true,
                bggId: true,
                name: true,
                thumbnail: true,
                playingTime: true,
                minPlayers: true,
                maxPlayers: true,
                weight: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  return NextResponse.json(sessions);
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
  const { name, date, playerCount, totalMinutes, gameIds } = body;

  if (!date || !playerCount || !totalMinutes) {
    return NextResponse.json(
      { error: "Fecha, jugadores y duración son obligatorios" },
      { status: 400 }
    );
  }

  // Validate games exist in the group
  const validGames = gameIds?.length
    ? await prisma.game.findMany({
        where: { id: { in: gameIds } },
        select: { id: true },
      })
    : [];
  const validGameIdSet = new Set(validGames.map((g) => g.id));

  const gameSession = await prisma.gameSession.create({
    data: {
      groupId,
      name: name || null,
      date: new Date(date),
      playerCount: parseInt(playerCount),
      totalMinutes: parseInt(totalMinutes),
      createdById: session.userId,
      games: {
        create: (gameIds || [])
          .filter((id: string) => validGameIdSet.has(id))
          .map((gameId: string, index: number) => ({
            gameId,
            order: index + 1,
          })),
      },
    },
    include: {
      games: {
        orderBy: { order: "asc" },
        include: { game: true },
      },
    },
  });

  logActivity("session_created", session.userId, { groupId, sessionName: name || null, gameCount: (gameIds || []).length });

  return NextResponse.json(gameSession, { status: 201 });
}
