import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";
import { computeRanking } from "@/lib/ranking";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { id } = await params;

  const [group, ranking, votes, sessions] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, displayName: true, email: true, avatarUrl: true },
        },
        members: {
          orderBy: { joinedAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                bggUsername: true,
              },
            },
          },
        },
      },
    }),
    computeRanking(id),
    prisma.vote.findMany({
      where: { groupGame: { groupId: id } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, displayName: true, email: true } },
        groupGame: { include: { game: { select: { name: true, thumbnail: true } } } },
      },
    }),
    prisma.gameSession.findMany({
      where: { groupId: id },
      orderBy: { date: "desc" },
      include: {
        createdBy: { select: { name: true, displayName: true, email: true } },
        games: { include: { game: { select: { name: true } } } },
      },
    }),
  ]);

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: group.id,
    name: group.name,
    type: group.type,
    createdAt: group.createdAt,
    inviteEnabled: group.inviteEnabled,
    owner: group.createdBy,
    members: group.members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      pinned: m.pinned,
      lastPingedAt: m.lastPingedAt,
      user: {
        id: m.user.id,
        name: m.user.displayName || m.user.name || m.user.email,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        bggUsername: m.user.bggUsername,
      },
    })),
    ranking: ranking.map((r) => {
      const breakdown = new Map<number, number>();
      for (const v of votes) {
        if (v.groupGameId === r.groupGameId) {
          breakdown.set(v.value, (breakdown.get(v.value) || 0) + 1);
        }
      }
      return {
        groupGameId: r.groupGameId,
        gameId: r.game.id,
        gameName: r.game.name,
        thumbnail: r.game.thumbnail,
        score: r.score,
        playCount: r.playCount,
        breakdown: Array.from(breakdown.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([value, count]) => ({ value, count })),
      };
    }),
    votes: votes.map((v) => ({
      id: v.id,
      value: v.value,
      createdAt: v.createdAt,
      groupGameId: v.groupGameId,
      gameName: v.groupGame.game.name,
      thumbnail: v.groupGame.game.thumbnail,
      user: {
        id: v.user.id,
        name: v.user.displayName || v.user.name || v.user.email,
        email: v.user.email,
      },
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date,
      status: s.status,
      playerCount: s.playerCount,
      totalMinutes: s.totalMinutes,
      createdBy: s.createdBy.displayName || s.createdBy.name || s.createdBy.email,
      games: s.games.map((g) => ({ name: g.game.name, status: g.status })),
    })),
  });
}
