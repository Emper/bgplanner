import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";

const DAYS = 30;

function bucketByDay(rows: { createdAt: Date }[]): { date: string; count: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: { date: string; count: number }[] = [];
  const map = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, 0);
    buckets.push({ date: key, count: 0 });
  }
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }
  return buckets.map((b) => ({ date: b.date, count: map.get(b.date) || 0 }));
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);

  const [
    usersCount,
    groupsCount,
    eventsPublic,
    eventsPrivate,
    gamesCount,
    votesCount,
    sessionsCount,
    recentUsers,
    recentGroups,
    recentEvents,
    recentVotes,
    topVotedGames,
    topGroupsBySessions,
    topUsersByVotes,
    topUsersBySessions,
    otpsLast24h,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.event.count({ where: { visibility: "public" } }),
    prisma.event.count({ where: { visibility: "private" } }),
    prisma.game.count(),
    prisma.vote.count(),
    prisma.gameSession.count(),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.group.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.event.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.vote.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.vote.groupBy({
      by: ["groupGameId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.gameSession.groupBy({
      by: ["groupId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.vote.groupBy({
      by: ["userId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.gameSession.groupBy({
      by: ["createdById"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.otpCode.count({ where: { createdAt: { gte: last24h } } }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true, displayName: true, email: true } },
        group: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Resolve top voted games (groupGameId → game name + group)
  const topGroupGameIds = topVotedGames.map((v) => v.groupGameId);
  const groupGames = topGroupGameIds.length
    ? await prisma.groupGame.findMany({
        where: { id: { in: topGroupGameIds } },
        include: {
          game: { select: { name: true, thumbnail: true } },
          group: { select: { id: true, name: true } },
        },
      })
    : [];
  const groupGameMap = new Map(groupGames.map((gg) => [gg.id, gg]));
  const topGames = topVotedGames
    .map((v) => {
      const gg = groupGameMap.get(v.groupGameId);
      if (!gg) return null;
      return {
        groupGameId: v.groupGameId,
        gameName: gg.game.name,
        thumbnail: gg.game.thumbnail,
        groupId: gg.group.id,
        groupName: gg.group.name,
        votes: v._count.id,
      };
    })
    .filter(Boolean);

  // Top groups
  const topGroupIds = topGroupsBySessions.map((g) => g.groupId);
  const topGroupsData = topGroupIds.length
    ? await prisma.group.findMany({
        where: { id: { in: topGroupIds } },
        select: { id: true, name: true, _count: { select: { members: true, games: true } } },
      })
    : [];
  const topGroupsMap = new Map(topGroupsData.map((g) => [g.id, g]));
  const topGroups = topGroupsBySessions
    .map((g) => {
      const data = topGroupsMap.get(g.groupId);
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        sessions: g._count.id,
        members: data._count.members,
        games: data._count.games,
      };
    })
    .filter(Boolean);

  // Top users (combined: votes + sessions created)
  const userActivityMap = new Map<string, { votes: number; sessions: number }>();
  for (const v of topUsersByVotes) {
    userActivityMap.set(v.userId, { votes: v._count.id, sessions: 0 });
  }
  for (const s of topUsersBySessions) {
    const existing = userActivityMap.get(s.createdById) || { votes: 0, sessions: 0 };
    existing.sessions = s._count.id;
    userActivityMap.set(s.createdById, existing);
  }
  const topUserIds = Array.from(userActivityMap.keys());
  const topUsersData = topUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, name: true, displayName: true, email: true, avatarUrl: true },
      })
    : [];
  const topUsers = topUsersData
    .map((u) => {
      const stats = userActivityMap.get(u.id) || { votes: 0, sessions: 0 };
      return {
        id: u.id,
        name: u.displayName || u.name || u.email,
        email: u.email,
        avatarUrl: u.avatarUrl,
        votes: stats.votes,
        sessions: stats.sessions,
        score: stats.votes + stats.sessions * 3,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return NextResponse.json({
    totals: {
      users: usersCount,
      groups: groupsCount,
      eventsPublic,
      eventsPrivate,
      games: gamesCount,
      votes: votesCount,
      sessions: sessionsCount,
    },
    activity: {
      users: bucketByDay(recentUsers),
      groups: bucketByDay(recentGroups),
      events: bucketByDay(recentEvents),
      votes: bucketByDay(recentVotes),
    },
    tops: {
      games: topGames,
      groups: topGroups,
      users: topUsers,
    },
    health: {
      otpsLast24h,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        createdAt: a.createdAt,
        userName: a.user.displayName || a.user.name || a.user.email,
        groupName: a.group?.name || null,
        groupId: a.group?.id || null,
        eventName: a.event?.name || null,
        eventId: a.event?.id || null,
        metadata: a.metadata,
      })),
    },
  });
}
