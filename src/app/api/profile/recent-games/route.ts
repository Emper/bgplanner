import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Find games the user added or voted on, across all groups
  const recentGames = await prisma.groupGame.findMany({
    where: {
      OR: [
        { addedById: session.userId },
        { votes: { some: { userId: session.userId } } },
      ],
    },
    include: {
      game: { select: { name: true, thumbnail: true, bggId: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: "desc" },
    take: 8,
  });

  const result = recentGames.map((gg) => ({
    gameId: gg.game.bggId,
    gameName: gg.game.name,
    thumbnail: gg.game.thumbnail,
    groupId: gg.group.id,
    groupName: gg.group.name,
    date: gg.addedAt,
  }));

  return NextResponse.json(result);
}
