import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSuperadmin } from "@/lib/api";
import { DELETED_USER_ROLE, displayName } from "@/lib/users";

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

export const GET = apiHandler(async (request: NextRequest) => {
  await requireSuperadmin(request);

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
    nightsCount,
    recentUsers,
    recentGroups,
    recentEvents,
    recentVotes,
    topVotedGames,
    topGroupsByNights,
    topUsersByVotes,
    topUsersByNights,
    otpsLast24h,
    recentActivity,
  ] = await Promise.all([
    // Sin los «Usuario eliminado» de las cuentas borradas
    prisma.user.count({ where: { role: { not: DELETED_USER_ROLE } } }),
    prisma.group.count(),
    prisma.event.count({ where: { visibility: "public" } }),
    prisma.event.count({ where: { visibility: "private" } }),
    prisma.game.count(),
    prisma.vote.count(),
    prisma.gameNight.count(),
    prisma.user.findMany({
      where: { createdAt: { gte: since }, role: { not: DELETED_USER_ROLE } },
      select: { createdAt: true },
    }),
    prisma.group.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.event.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.vote.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.vote.groupBy({
      by: ["groupGameId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.gameNight.groupBy({
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
    // Quien más noches ha jugado
    prisma.gameNightPlayer.groupBy({
      by: ["userId"],
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
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

  // Los nombres de los tops, de una vez: juego y grupo de cada groupGameId,
  // datos de los grupos con más noches y de los usuarios más activos.
  const topGroupGameIds = topVotedGames.map((v) => v.groupGameId);
  const topGroupIds = topGroupsByNights.map((g) => g.groupId);
  const topUserIds = [
    ...new Set([...topUsersByVotes, ...topUsersByNights].map((u) => u.userId)),
  ];
  const [groupGames, topGroupsData, topUsersData] = await Promise.all([
    topGroupGameIds.length
      ? prisma.groupGame.findMany({
          where: { id: { in: topGroupGameIds } },
          include: {
            game: { select: { name: true, thumbnail: true } },
            group: { select: { id: true, name: true } },
          },
        })
      : [],
    topGroupIds.length
      ? prisma.group.findMany({
          where: { id: { in: topGroupIds } },
          select: { id: true, name: true, _count: { select: { members: true, games: true } } },
        })
      : [],
    topUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: topUserIds } },
          select: { id: true, name: true, displayName: true, email: true, avatarUrl: true },
        })
      : [],
  ]);

  // Top voted games (groupGameId → game name + group)
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
  const topGroupsMap = new Map(topGroupsData.map((g) => [g.id, g]));
  const topGroups = topGroupsByNights
    .map((g) => {
      const data = topGroupsMap.get(g.groupId);
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        nights: g._count.id,
        members: data._count.members,
        games: data._count.games,
      };
    })
    .filter(Boolean);

  // Top users (combined: votes + nights played)
  const userActivityMap = new Map<string, { votes: number; nights: number }>();
  for (const v of topUsersByVotes) {
    userActivityMap.set(v.userId, { votes: v._count.id, nights: 0 });
  }
  for (const n of topUsersByNights) {
    const existing = userActivityMap.get(n.userId) || { votes: 0, nights: 0 };
    existing.nights = n._count.userId;
    userActivityMap.set(n.userId, existing);
  }
  const topUsers = topUsersData
    .map((u) => {
      const stats = userActivityMap.get(u.id) || { votes: 0, nights: 0 };
      return {
        id: u.id,
        name: displayName(u, u.email),
        email: u.email,
        avatarUrl: u.avatarUrl,
        votes: stats.votes,
        nights: stats.nights,
        score: stats.votes + stats.nights * 3,
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
      nights: nightsCount,
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
        userName: displayName(a.user, a.user.email),
        groupName: a.group?.name || null,
        groupId: a.group?.id || null,
        eventName: a.event?.name || null,
        eventId: a.event?.id || null,
        metadata: a.metadata,
      })),
    },
  });
});
