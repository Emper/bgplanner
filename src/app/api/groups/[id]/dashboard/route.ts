import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  // Run ALL queries in parallel — single cold start, single DB connection
  const [membership, group, memberCount, groupGames, sessions] =
    await Promise.all([
      prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: session.userId } },
      }),
      prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  surname: true,
                  email: true,
                  bggUsername: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { user: { name: "asc" } },
          },
          _count: { select: { games: true } },
          invitations: {
            where: { status: "pending" },
            select: { email: true, createdAt: true },
          },
        },
      }),
      prisma.groupMember.count({ where: { groupId } }),
      prisma.groupGame.findMany({
        where: { groupId, archivedAt: null },
        include: {
          game: true,
          addedBy: { select: { name: true, displayName: true } },
          votes: { select: { userId: true, value: true, user: { select: { name: true, displayName: true, email: true } } } },
        },
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

  // Count completed plays per game and track last played date from sessions
  const playCountByGameId = new Map<string, number>();
  const lastSessionDateByGameId = new Map<string, Date>();
  for (const s of sessions) {
    for (const sg of s.games) {
      if (sg.status === "completed") {
        playCountByGameId.set(sg.game.id, (playCountByGameId.get(sg.game.id) || 0) + 1);
        const existing = lastSessionDateByGameId.get(sg.game.id);
        if (!existing || s.date > existing) {
          lastSessionDateByGameId.set(sg.game.id, s.date);
        }
      }
    }
  }

  // Compute ranking in memory
  const ranking = groupGames
    .map((gg) => {
      const score = gg.votes.reduce((acc, v) => acc + v.value, 0);

      const userVote = gg.votes.find((v) => v.userId === session.userId);
      const voters = gg.votes.map((v) => ({
        userId: v.userId,
        name: v.user.displayName || v.user.name || v.user.email,
        value: v.value,
      }));

      const playCount = playCountByGameId.get(gg.game.id) || 0;
      const lastSessionDate = lastSessionDateByGameId.get(gg.game.id) || null;
      // Use playedAt (manual mark) or last session date, whichever is more recent
      const lastPlayedDate = gg.playedAt && lastSessionDate
        ? (gg.playedAt > lastSessionDate ? gg.playedAt : lastSessionDate)
        : gg.playedAt || lastSessionDate;

      return {
        groupGameId: gg.id,
        game: gg.game,
        addedBy: gg.addedBy,
        addedById: gg.addedById,
        score,
        voters,
        userVoteValue: userVote?.value ?? null,
        playCount,
        playedAt: gg.playedAt,
        lastPlayedDate,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.game.bggRating || 0) - (a.game.bggRating || 0);
    });

  const response = NextResponse.json({
    group: {
      ...group,
      currentUserRole: membership.role,
      currentUserId: session.userId,
      currentUserLastPingedAt: membership.lastPingedAt,
    },
    ranking,
    memberCount,
    sessions,
  });

  // No CDN cache — response is personalized per user (userVote, currentUserId)
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}
