import { prisma } from "./prisma";
import { parsePage } from "./api";
import { THREADS_PAGE_SIZE } from "./community";
import { getLatestThreads } from "./communityServer";
import { listVisibleEvents } from "./eventList";
import { getMyFeed, MY_FEED_PAGE } from "./feedData";
import { listMyGroups } from "./groupList";

const RECENT_GAMES_LIMIT = 12;

/**
 * Juegos que alguien ha añadido o votado, en todos sus grupos, sin repetir
 * (el mismo juego en dos grupos sale una vez). La usan
 * GET /api/profile/recent-games y el inicio pintado en el servidor.
 */
export async function getRecentGames(userId: string) {
  const recentGames = await prisma.groupGame.findMany({
    where: {
      OR: [
        { addedById: userId },
        { votes: { some: { userId } } },
      ],
    },
    include: {
      game: { select: { name: true, thumbnail: true, bggId: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: "desc" },
    // De sobra para quitar los repetidos (el mismo juego en dos grupos)
    take: RECENT_GAMES_LIMIT * 2,
  });

  const seen = new Set<number>();
  const unique = recentGames.filter((gg) => {
    if (seen.has(gg.game.bggId)) return false;
    seen.add(gg.game.bggId);
    return true;
  }).slice(0, RECENT_GAMES_LIMIT);

  // La carátula grande, para las tarjetas; la miniatura de BGG se queda corta
  const infos = await prisma.bggGameInfo.findMany({
    where: { bggId: { in: unique.map((gg) => gg.game.bggId) } },
    select: { bggId: true, image: true },
  });
  const imageById = new Map(infos.map((i) => [i.bggId, i.image]));

  return unique.map((gg) => ({
    gameId: gg.game.bggId,
    gameName: gg.game.name,
    thumbnail: gg.game.thumbnail,
    image: imageById.get(gg.game.bggId) ?? null,
    groupId: gg.group.id,
    groupName: gg.group.name,
    date: gg.addedAt,
  }));
}

// Lo que pide el inicio al arrancar, con los mismos parámetros que usaba el
// navegador (/api/feed?limit=10, /api/community?limit=4…).
const HOME_FEED_PARAMS = new URLSearchParams({ limit: "10" });
const HOME_THREADS = 4;

/**
 * Todo lo que pinta el inicio con sesión, pedido en paralelo desde el
 * servidor. Como hacía el navegador, solo los grupos son imprescindibles: si
 * falla otra cosa, esa sección sale vacía en vez de tumbar la página.
 */
export async function getHomeData(userId: string) {
  const { limit, cursor } = parsePage(HOME_FEED_PARAMS, MY_FEED_PAGE);
  const [groups, recentGames, events, feed, threads] = await Promise.all([
    listMyGroups(userId),
    getRecentGames(userId).catch(() => []),
    listVisibleEvents(userId, { upcoming: true }).catch(() => []),
    getMyFeed(userId, { limit, cursor }).catch(() => ({ items: [], nextCursor: null })),
    getLatestThreads(Math.min(HOME_THREADS, THREADS_PAGE_SIZE), userId).catch(() => []),
  ]);
  return { groups, recentGames, events, feed, threads };
}
