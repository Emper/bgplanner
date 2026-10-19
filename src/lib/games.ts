import { prisma } from "@/lib/prisma";
import { fetchBggGameDetails } from "@/lib/bgg";

export type GameRecord = {
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

// Cuánto tiempo consideramos "fresco" el dato cacheado de un juego antes de
// intentar refrescarlo desde BGG (rating/rank/peso cambian con el tiempo).
const GAME_DATA_TTL = 30 * 24 * 60 * 60 * 1000; // 30 días

/**
 * Find or create a Game record by bggId.
 * Tries: 1) existing Game, 2) CollectionGame cache, 3) BGG API, 4) fallback name.
 * Si el Game cacheado está caducado (> GAME_DATA_TTL) intenta refrescarlo
 * desde BGG; si BGG falla, devuelve el dato cacheado sin romper el flujo.
 * Returns null only if all strategies fail and no fallbackName provided.
 */
export async function findOrCreateGame(
  bggId: number,
  fallbackName?: string
): Promise<GameRecord | null> {
  // 1. Check if game already exists
  const existing = await prisma.game.findUnique({ where: { bggId } });
  if (existing) {
    const isStale = Date.now() - existing.updatedAt.getTime() > GAME_DATA_TTL;
    if (!isStale) return existing;

    // Refresco best-effort: si BGG no responde, seguimos con la caché.
    try {
      const [details] = await fetchBggGameDetails([bggId]);
      if (details) {
        return await prisma.game.update({
          where: { bggId },
          data: {
            name: details.name,
            thumbnail: details.thumbnail,
            yearPublished: details.yearPublished,
            minPlayers: details.minPlayers,
            maxPlayers: details.maxPlayers,
            playingTime: details.playingTime,
            bggRating: details.bggRating,
            bggRank: details.bggRank,
            weight: details.weight,
          },
        });
      }
    } catch (err) {
      console.log("[findOrCreateGame] refresco fallido, uso caché:", err);
    }
    return existing;
  }

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
          playingTime: details.playingTime,
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

/**
 * findOrCreateGame para muchos juegos a la vez (p. ej. una geeklist entera):
 * lo que no está en `Game` se saca de las colecciones cacheadas y, lo que
 * falte, de BGG en lotes de 20. Si BGG falla, se crean con el nombre que
 * traen. No refresca los que ya existen.
 */
export async function ensureGames(
  items: { bggId: number; name: string }[]
): Promise<Map<number, GameRecord>> {
  const ids = [...new Set(items.map((i) => i.bggId))];
  const byId = new Map<number, GameRecord>();
  const load = async (bggIds: number[]) => {
    if (bggIds.length === 0) return;
    const games = await prisma.game.findMany({ where: { bggId: { in: bggIds } } });
    for (const g of games) byId.set(g.bggId, g);
  };
  const missing = () => ids.filter((id) => !byId.has(id));

  await load(ids);

  if (missing().length > 0) {
    const cached = await prisma.collectionGame.findMany({
      where: { bggId: { in: missing() } },
      distinct: ["bggId"],
      select: {
        bggId: true,
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
    await prisma.game.createMany({ data: cached, skipDuplicates: true });
    await load(cached.map((c) => c.bggId));
  }

  if (missing().length > 0) {
    try {
      const details = await fetchBggGameDetails(missing());
      await prisma.game.createMany({
        data: details.map((d) => ({
          bggId: d.bggId,
          name: d.name,
          thumbnail: d.thumbnail,
          yearPublished: d.yearPublished,
          minPlayers: d.minPlayers,
          maxPlayers: d.maxPlayers,
          playingTime: d.playingTime,
          bggRating: d.bggRating,
          bggRank: d.bggRank,
          weight: d.weight,
        })),
        skipDuplicates: true,
      });
      await load(details.map((d) => d.bggId));
    } catch (err) {
      console.log("[ensureGames] BGG API unavailable:", err);
    }
  }

  const rest = missing();
  if (rest.length > 0) {
    const names = new Map(items.map((i) => [i.bggId, i.name]));
    await prisma.game.createMany({
      data: rest.map((bggId) => ({ bggId, name: names.get(bggId) ?? `Juego ${bggId}` })),
      skipDuplicates: true,
    });
    await load(rest);
  }

  return byId;
}
