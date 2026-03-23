import { prisma } from "@/lib/prisma";
import { fetchBggGameDetails } from "@/lib/bgg";

type GameRecord = {
  id: string;
  bggId: number;
  name: string;
  thumbnail: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  bggRating: number | null;
  bggRank: number | null;
  weight: number | null;
};

/**
 * Find or create a Game record by bggId.
 * Tries: 1) existing Game, 2) CollectionGame cache, 3) BGG API, 4) fallback name.
 * Returns null only if all strategies fail and no fallbackName provided.
 */
export async function findOrCreateGame(
  bggId: number,
  fallbackName?: string
): Promise<GameRecord | null> {
  // 1. Check if game already exists
  const existing = await prisma.game.findUnique({ where: { bggId } });
  if (existing) return existing;

  // 2. Try CollectionGame cache
  const cachedItem = await prisma.collectionGame.findFirst({
    where: { bggId },
    select: {
      name: true,
      thumbnail: true,
      yearPublished: true,
      minPlayers: true,
      maxPlayers: true,
      playingTime: true,
      bggRating: true,
      bggRank: true,
      weight: true,
    },
  });

  if (cachedItem) {
    return prisma.game.create({
      data: { bggId, ...cachedItem },
    });
  }

  // 3. Try BGG API
  try {
    const [details] = await fetchBggGameDetails([bggId]);
    if (details) {
      return prisma.game.create({
        data: {
          bggId,
          name: details.name,
          thumbnail: details.thumbnail,
          yearPublished: details.yearPublished,
          minPlayers: details.minPlayers,
          maxPlayers: details.maxPlayers,
          bggRating: details.bggRating,
          bggRank: details.bggRank,
          weight: details.weight,
        },
      });
    }
  } catch (err) {
    console.log("[findOrCreateGame] BGG API unavailable:", err);
  }

  // 4. Fallback: create with basic data
  if (fallbackName) {
    return prisma.game.create({
      data: { bggId, name: fallbackName },
    });
  }

  return null;
}
