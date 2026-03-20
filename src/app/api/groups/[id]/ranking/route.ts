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

  // Run all queries in parallel for better performance
  const [membership, memberCount, groupGames, completedPlays] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
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
    prisma.gameSessionGame.groupBy({
      by: ["gameId"],
      where: {
        status: "completed",
        session: { groupId },
      },
      _count: { id: true },
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const playCountByGameId = new Map(
    completedPlays.map((p) => [p.gameId, p._count.id])
  );

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
        addedById: gg.addedById,
        score,
        upVotes,
        superVotes,
        downVotes,
        userVote: userVote?.type || null,
        playCount: playCountByGameId.get(gg.game.id) || 0,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.game.bggRating || 0) - (a.game.bggRating || 0);
    });

  const response = NextResponse.json({ ranking, memberCount });
  // No CDN cache — response includes per-user vote data
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
