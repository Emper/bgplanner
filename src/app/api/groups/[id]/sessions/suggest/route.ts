import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { compareRanking, voteScore } from "@/lib/rankingOrder";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const sp = request.nextUrl.searchParams;
  const playerCount = Math.max(1, parseInt(sp.get("players") || "4") || 4);
  const totalMinutes = Math.max(15, parseInt(sp.get("minutes") || "180") || 180);

  // Run membership check and data fetch in parallel
  const [membership, groupGames] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    // Lo archivado no entra. Lo ya jugado se puede añadir a mano a una
    // sesión, pero la propuesta automática sale solo de los pendientes.
    prisma.groupGame.findMany({
      where: { groupId, archivedAt: null },
      include: {
        game: true,
        votes: { select: { value: true } },
      },
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  // Score and filter by player count
  const scored = groupGames
    .filter((gg) => {
      const min = gg.game.minPlayers ?? 0;
      const max = gg.game.maxPlayers ?? 99;
      return playerCount >= min && playerCount <= max;
    })
    .map((gg) => {
      const score = voteScore(gg.votes);
      return {
        gameId: gg.game.id,
        bggId: gg.game.bggId,
        name: gg.game.name,
        thumbnail: gg.game.thumbnail,
        playingTime: gg.game.playingTime,
        weight: gg.game.weight,
        minPlayers: gg.game.minPlayers,
        maxPlayers: gg.game.maxPlayers,
        score,
        played: gg.playedAt !== null,
        game: { bggRating: gg.game.bggRating },
      };
    })
    .sort(compareRanking);

  // Greedy fill: pick top-scored games that fit in the time budget
  const suggested: typeof scored = [];
  let remainingMinutes = totalMinutes;

  const pending = scored.filter((g) => !g.played);
  for (const game of pending) {
    const time = game.playingTime || 90; // Default 90 min if unknown
    if (time <= remainingMinutes) {
      suggested.push(game);
      remainingMinutes -= time;
    }
    // Always include at least the top game even if it exceeds time
    if (suggested.length === 0 && game === pending[0]) {
      suggested.push(game);
      remainingMinutes -= time;
    }
  }

  const totalTime = suggested.reduce(
    (acc, g) => acc + (g.playingTime || 90),
    0
  );

  return NextResponse.json({
    suggested,
    all: scored,
    totalTime,
    remainingMinutes: totalMinutes - totalTime,
    playerCount,
    totalMinutes,
  });
}
