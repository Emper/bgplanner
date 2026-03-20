import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
  const { status, gameIds } = body;

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;

  const gameSession = await prisma.gameSession.update({
    where: { id: sessionId },
    data: updateData,
    include: {
      games: {
        orderBy: { order: "asc" },
        include: { game: true },
      },
    },
  });

  // If gameIds provided, replace session games
  if (gameIds && Array.isArray(gameIds)) {
    await prisma.gameSessionGame.deleteMany({
      where: { sessionId },
    });
    await prisma.gameSessionGame.createMany({
      data: gameIds.map((gameId: string, index: number) => ({
        sessionId,
        gameId,
        order: index + 1,
      })),
    });
  }

  return NextResponse.json(gameSession);
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
