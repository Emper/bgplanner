import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { getGroupType } from "@/lib/groupTypes";

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

      if (newStatus === "completed") {
        const sessionGame = await prisma.gameSessionGame.findUnique({
          where: { id: gameSessionGameId },
          include: { game: { select: { id: true, name: true, thumbnail: true } } },
        });
        if (sessionGame) {
          logActivity("session_game_completed", session.userId, { groupId, gameName: sessionGame.game.name });

          // Release slot-limited votes on this game (e.g. super vote in friends mode)
          const groupGame = await prisma.groupGame.findFirst({
            where: { groupId, gameId: sessionGame.game.id },
          });
          if (groupGame) {
            const groupData = await prisma.group.findUnique({
              where: { id: groupId },
              select: { name: true, type: true },
            });
            const limitedValues = getGroupType(groupData?.type)
              .voteLimits.filter((l) => l.max <= 1)
              .map((l) => l.value);
            const superVotes = limitedValues.length
              ? await prisma.vote.findMany({
                  where: { groupGameId: groupGame.id, value: { in: limitedValues } },
                  select: { userId: true },
                })
              : [];
            if (superVotes.length > 0) {
              await prisma.vote.updateMany({
                where: { groupGameId: groupGame.id, value: { in: limitedValues } },
                data: { value: 1 },
              });
              notify({
                type: "super_vote_freed",
                userIds: superVotes.map((v) => v.userId),
                actorId: session.userId,
                groupId,
                metadata: { gameName: sessionGame.game.name, thumbnail: sessionGame.game.thumbnail ?? null },
              });
            }
          }
        }
      }
    }
  }

  // Return updated session
  const updated = await prisma.gameSession.findUnique({
    where: { id: sessionId },
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
  });

  logActivity("session_updated", session.userId, { groupId });

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

  logActivity("session_deleted", session.userId, { groupId });

  return NextResponse.json({ ok: true });
}
