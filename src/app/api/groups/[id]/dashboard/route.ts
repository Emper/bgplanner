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
                  surname: true,
                  email: true,
                  bggUsername: true,
                },
              },
            },
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
        where: { groupId },
        include: {
          game: true,
          addedBy: { select: { name: true } },
          votes: { select: { userId: true, type: true } },
        },
      }),
      prisma.gameSession.findMany({
        where: { groupId },
        orderBy: { date: "desc" },
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

  // Compute ranking in memory
  const ranking = groupGames
    .map((gg) => {
      const score = gg.votes.reduce((acc, v) => {
        if (v.type === "super") return acc + 3;
        if (v.type === "down") return acc - 1;
        return acc + 1;
      }, 0);

      const upVotes = gg.votes.filter((v) => v.type === "up").length;
      const superVotes = gg.votes.filter((v) => v.type === "super").length;
      const downVotes = gg.votes.filter((v) => v.type === "down").length;
      const userVote = gg.votes.find((v) => v.userId === session.userId);

      return {
        groupGameId: gg.id,
        game: gg.game,
        addedBy: gg.addedBy,
        score,
        upVotes,
        superVotes,
        downVotes,
        userVote: userVote?.type || null,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.game.bggRating || 0) - (a.game.bggRating || 0);
    });

  const response = NextResponse.json({
    group: { ...group, currentUserRole: membership.role },
    ranking,
    memberCount,
    sessions,
  });

  // Cache on Vercel edge for 10s, serve stale up to 60s while revalidating
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=10, stale-while-revalidate=60"
  );

  return response;
}
