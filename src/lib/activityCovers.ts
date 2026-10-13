import { prisma } from "./prisma";

// El log de actividad guarda el nombre del juego, no su carátula. Para que
// el feed enseñe la caja, se busca aquí al servirlo: primero entre los juegos
// del grupo o del evento donde pasó (lo más fiable, que hay ediciones con el
// mismo nombre) y, si ya no está ahí (lo quitaron), en el catálogo general.

interface CoverableItem {
  groupId?: string | null;
  eventId?: string | null;
  group?: { id: string } | null;
  event?: { id: string } | null;
  metadata: unknown;
}

const groupOf = (i: CoverableItem) => i.groupId ?? i.group?.id ?? null;
const eventOf = (i: CoverableItem) => i.eventId ?? i.event?.id ?? null;

function gameNameOf(item: CoverableItem): string | null {
  const meta = item.metadata as Record<string, unknown> | null;
  const name = meta?.gameName;
  return typeof name === "string" && name.trim() ? name : null;
}

export async function withGameCovers<T extends CoverableItem>(
  items: T[]
): Promise<(T & { thumbnail: string | null })[]> {
  const withName = items.filter((i) => gameNameOf(i));
  if (withName.length === 0) return items.map((i) => ({ ...i, thumbnail: null }));

  const names = [...new Set(withName.map((i) => gameNameOf(i)!))];
  const groupIds = [...new Set(withName.map(groupOf).filter((x): x is string => !!x))];
  const eventIds = [...new Set(withName.map(eventOf).filter((x): x is string => !!x))];

  const [groupGames, eventGames, catalog] = await Promise.all([
    groupIds.length
      ? prisma.groupGame.findMany({
          where: { groupId: { in: groupIds }, game: { name: { in: names } } },
          select: { groupId: true, game: { select: { name: true, thumbnail: true } } },
        })
      : [],
    eventIds.length
      ? prisma.eventGame.findMany({
          where: { eventId: { in: eventIds }, game: { name: { in: names } } },
          select: { eventId: true, game: { select: { name: true, thumbnail: true } } },
        })
      : [],
    prisma.game.findMany({
      where: { name: { in: names }, thumbnail: { not: null } },
      select: { name: true, thumbnail: true },
    }),
  ]);

  const scoped = new Map<string, string | null>();
  for (const gg of groupGames) scoped.set(`g:${gg.groupId}:${gg.game.name}`, gg.game.thumbnail);
  for (const eg of eventGames) scoped.set(`e:${eg.eventId}:${eg.game.name}`, eg.game.thumbnail);
  const global = new Map<string, string | null>();
  for (const g of catalog) if (!global.has(g.name)) global.set(g.name, g.thumbnail);

  return items.map((item) => {
    const name = gameNameOf(item);
    if (!name) return { ...item, thumbnail: null };
    const groupId = groupOf(item);
    const eventId = eventOf(item);
    const key = groupId ? `g:${groupId}:${name}` : eventId ? `e:${eventId}:${name}` : null;
    const thumbnail = (key && scoped.get(key)) || global.get(name) || null;
    return { ...item, thumbnail };
  });
}
