import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSession } from "@/lib/api";

const LIMIT = 12;

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  // Juegos que ha añadido o votado, en todos sus grupos
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
    // De sobra para quitar los repetidos (el mismo juego en dos grupos)
    take: LIMIT * 2,
  });

  const seen = new Set<number>();
  const unique = recentGames.filter((gg) => {
    if (seen.has(gg.game.bggId)) return false;
    seen.add(gg.game.bggId);
    return true;
  }).slice(0, LIMIT);

  // La carátula grande, para las tarjetas; la miniatura de BGG se queda corta
  const infos = await prisma.bggGameInfo.findMany({
    where: { bggId: { in: unique.map((gg) => gg.game.bggId) } },
    select: { bggId: true, image: true },
  });
  const imageById = new Map(infos.map((i) => [i.bggId, i.image]));

  const result = unique.map((gg) => ({
    gameId: gg.game.bggId,
    gameName: gg.game.name,
    thumbnail: gg.game.thumbnail,
    image: imageById.get(gg.game.bggId) ?? null,
    groupId: gg.group.id,
    groupName: gg.group.name,
    date: gg.addedAt,
  }));

  return NextResponse.json(result);
});
