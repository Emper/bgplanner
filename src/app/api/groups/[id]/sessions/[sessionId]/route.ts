import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { resend } from "@/lib/resend";

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

      if (newStatus === "completed") {
        const sessionGame = await prisma.gameSessionGame.findUnique({
          where: { id: gameSessionGameId },
          include: { game: { select: { id: true, name: true } } },
        });
        if (sessionGame) {
          logActivity("session_game_completed", session.userId, { groupId, gameName: sessionGame.game.name });

          // Release super votes on this game (same logic as "mark as played")
          const groupGame = await prisma.groupGame.findFirst({
            where: { groupId, gameId: sessionGame.game.id },
          });
          if (groupGame) {
            const superVotes = await prisma.vote.findMany({
              where: { groupGameId: groupGame.id, type: "super" },
              include: { user: { select: { email: true, name: true } } },
            });
            if (superVotes.length > 0) {
              await prisma.vote.updateMany({
                where: { groupGameId: groupGame.id, type: "super" },
                data: { type: "up" },
              });
              const groupData = await prisma.group.findUnique({
                where: { id: groupId },
                select: { name: true },
              });
              for (const vote of superVotes) {
                resend.emails.send({
                  from: "BG Planner <cesar@tiradacritica.es>",
                  to: vote.user.email,
                  subject: `Tu super voto en "${groupData?.name}" se ha liberado`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
                      <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner</h2>
                      <p>¡Buenas noticias, ${vote.user.name || "jugador"}! 🎲</p>
                      <p>El juego <strong style="color: #f59e0b;">"${sessionGame.game.name}"</strong> en el grupo <strong>"${groupData?.name}"</strong> se ha completado en una sesión.</p>
                      <p>Tu super voto se ha convertido en un voto normal y <strong style="color: #f59e0b;">vuelves a tener tu super voto disponible</strong> para usarlo en otro juego del grupo.</p>
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app"}/groups/${groupId}" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
                        Ir al grupo
                      </a>
                    </div>
                  `,
                }).catch(() => {});
              }
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
