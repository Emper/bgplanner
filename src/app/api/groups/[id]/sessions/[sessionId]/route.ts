import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, sessionId } = await params;

  // Run membership check and data fetch in parallel
  const [membership, gameSession] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        createdBy: { select: { name: true } },
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

  if (!gameSession) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  return NextResponse.json(gameSession);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, sessionId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const body = await request.json();
  const { name, date, playerCount, totalMinutes, status, gameIds, gameStatuses } = body;

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name || null;
  if (date) updateData.date = new Date(date);
  if (playerCount) updateData.playerCount = parseInt(playerCount);
  if (totalMinutes) updateData.totalMinutes = parseInt(totalMinutes);
  if (status) updateData.status = status;

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  // Replace games if provided
  if (gameIds && Array.isArray(gameIds)) {
    await prisma.gameSessionGame.deleteMany({ where: { sessionId } });
    if (gameIds.length > 0) {
      await prisma.gameSessionGame.createMany({
        data: gameIds.map((gameId: string, index: number) => ({
          sessionId,
          gameId,
          order: index + 1,
        })),
      });
    }
  }

  // Update individual game statuses (e.g., mark as completed/skipped)
  if (gameStatuses && typeof gameStatuses === "object") {
    for (const [gameSessionGameId, newStatus] of Object.entries(gameStatuses)) {
      await prisma.gameSessionGame.update({
        where: { id: gameSessionGameId },
        data: { status: newStatus as string },
      });
    }
  }

  // Return updated session
  const updated = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      createdBy: { select: { name: true } },
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
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, sessionId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  await prisma.gameSession.delete({ where: { id: sessionId } });

  return NextResponse.json({ ok: true });
}
