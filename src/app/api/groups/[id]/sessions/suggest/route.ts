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
  const sp = request.nextUrl.searchParams;
  const playerCount = parseInt(sp.get("players") || "4");
  const totalMinutes = parseInt(sp.get("minutes") || "180");

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  // Get all group games with votes (ranked)
  const groupGames = await prisma.groupGame.findMany({
    where: { groupId },
    include: {
      game: true,
      votes: { select: { type: true } },
    },
  });

  // Score and filter by player count
  const scored = groupGames
    .filter((gg) => {
      const min = gg.game.minPlayers ?? 0;
      const max = gg.game.maxPlayers ?? 99;
      return playerCount >= min && playerCount <= max;
    })
    .map((gg) => {
      const score = gg.votes.reduce((acc, v) => {
        if (v.type === "super") return acc + 3;
        if (v.type === "down") return acc - 1;
        return acc + 1;
      }, 0);
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
      };
    })
    .sort((a, b) => b.score - a.score);

  // Greedy fill: pick top-scored games that fit in the time budget
  const suggested: typeof scored = [];
  let remainingMinutes = totalMinutes;

  for (const game of scored) {
    const time = game.playingTime || 90; // Default 90 min if unknown
    if (time <= remainingMinutes) {
      suggested.push(game);
      remainingMinutes -= time;
    }
    // Always include at least the top game even if it exceeds time
    if (suggested.length === 0 && game === scored[0]) {
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
