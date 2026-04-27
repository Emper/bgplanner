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
  const [membership, group, memberCount, groupGames, sessions, manualPlaysLog] =
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
          comments: { select: { userId: true, text: true, user: { select: { name: true, displayName: true, email: true } } } },
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
      prisma.activityLog.findMany({
        where: { groupId, type: "game_marked_played" },
        select: { metadata: true, createdAt: true },
      }),
    ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  // Count completed plays per game and track last played date from sessions
  const playCountByGameId = new Map<string, number>();
  const lastSessionDateByGameId = new Map<string, Date>();
  let totalSessionPlays = 0;
  let totalSessionMinutes = 0;
  let lastPlayedAt: Date | null = null;
  for (const s of sessions) {
    let sessionHasCompleted = false;
    for (const sg of s.games) {
      if (sg.status === "completed") {
        sessionHasCompleted = true;
        totalSessionPlays += 1;
        playCountByGameId.set(sg.game.id, (playCountByGameId.get(sg.game.id) || 0) + 1);
        const existing = lastSessionDateByGameId.get(sg.game.id);
        if (!existing || s.date > existing) {
          lastSessionDateByGameId.set(sg.game.id, s.date);
        }
      }
    }
    if (sessionHasCompleted) {
      totalSessionMinutes += s.totalMinutes;
      if (!lastPlayedAt || s.date > lastPlayedAt) lastPlayedAt = s.date;
    }
  }

  // Manual "marked as played" actions from the ranking. Each log entry counts
  // as one play; metadata.gameName lets us also bucket them per game so the
  // "most played" stat reflects manual marks too.
  const manualPlaysByGameName = new Map<string, number>();
  for (const log of manualPlaysLog) {
    const meta = log.metadata as { gameName?: string } | null;
    const name = meta?.gameName;
    if (name) manualPlaysByGameName.set(name, (manualPlaysByGameName.get(name) || 0) + 1);
    if (!lastPlayedAt || log.createdAt > lastPlayedAt) lastPlayedAt = log.createdAt;
  }
  const totalManualPlays = manualPlaysLog.length;

  // Compute ranking in memory
  const ranking = groupGames
    .map((gg) => {
      const score = gg.votes.reduce((acc, v) => acc + v.value, 0);

      const userVote = gg.votes.find((v) => v.userId === session.userId);

      // Mergeamos votos y comentarios por userId. Un voter "virtual"
      // (value = 0) representa a alguien que comentó pero retiró su voto.
      const commentByUserId = new Map(
        gg.comments.map((c) => [c.userId, c.text])
      );
      const voters = gg.votes.map((v) => ({
        userId: v.userId,
        name: v.user.displayName || v.user.name || v.user.email,
        value: v.value,
        comment: commentByUserId.get(v.userId) ?? null,
      }));
      const voterIds = new Set(voters.map((v) => v.userId));
      for (const c of gg.comments) {
        if (!voterIds.has(c.userId)) {
          voters.push({
            userId: c.userId,
            name: c.user.displayName || c.user.name || c.user.email,
            value: 0,
            comment: c.text,
          });
        }
      }

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

  // Combine session plays + manual marks per game to find the most played one
  let topGame: { name: string; thumbnail: string | null; playCount: number } | null = null;
  const combinedByGameId = new Map<string, number>(playCountByGameId);
  for (const gg of groupGames) {
    const manual = manualPlaysByGameName.get(gg.game.name) || 0;
    if (manual > 0) {
      combinedByGameId.set(gg.game.id, (combinedByGameId.get(gg.game.id) || 0) + manual);
    }
  }
  for (const gg of groupGames) {
    const count = combinedByGameId.get(gg.game.id) || 0;
    if (count > 0 && (!topGame || count > topGame.playCount)) {
      topGame = { name: gg.game.name, thumbnail: gg.game.thumbnail, playCount: count };
    }
  }

  const stats = {
    gamesCount: groupGames.length,
    playsCount: totalSessionPlays + totalManualPlays,
    totalMinutes: totalSessionMinutes,
    lastPlayedAt,
    topGame,
  };

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
    stats,
  });

  // No CDN cache — response is personalized per user (userVote, currentUserId)
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}
