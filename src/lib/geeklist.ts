import { prisma } from "./prisma";
import { fetchBggGeeklist, type BggGeeklist } from "./bgg";
import { ensureGames } from "./games";
import { logActivity } from "./activity";
import { inBackground, notify } from "./notifications";

// Un evento puede tomar sus juegos de una geeklist de BGG en vez de elegirlos
// a mano. La lista manda: lo que entra en ella aparece en el evento y lo que
// sale desaparece, salvo que alguien hubiera marcado interés. Entonces se
// queda, señalado con `leftGeeklistAt`, para no perder su lista a nadie.
//
// Se reimporta sola cuando alguien abre el evento (como mucho cada
// GEEKLIST_REFRESH_MS), una vez al día desde el cron y a mano desde la
// pestaña Juegos.

export const GEEKLIST_REFRESH_MS = 60 * 60 * 1000;
// A mano no hace falta esperar, pero tampoco importar dos veces seguidas
const GEEKLIST_MANUAL_GAP_MS = 60 * 1000;
// Pasado el evento la lista ya no cambia nada
const GEEKLIST_GRACE_MS = 24 * 60 * 60 * 1000;

export interface GeeklistSyncResult {
  title: string;
  total: number;
  added: number;
  removed: number;
  /** Han salido de la lista pero tenían intereses: se quedan, señalados. */
  flagged: number;
}

export function geeklistUrl(id: number) {
  return `https://boardgamegeek.com/geeklist/${id}`;
}

export function isEventOver(event: { date: Date; endDate: Date | null }) {
  return Date.now() > (event.endDate ?? event.date).getTime() + GEEKLIST_GRACE_MS;
}

/** Vuelca una lista ya descargada en el evento. */
export async function applyGeeklist(
  eventId: string,
  list: BggGeeklist,
  actorId: string | null
): Promise<GeeklistSyncResult> {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { id: true, name: true, createdById: true, geeklistSyncedAt: true },
  });

  const games = await ensureGames(list.items);
  // En el orden de la lista, para que el aviso nombre los primeros
  const listGames = list.items.map((i) => games.get(i.bggId)).filter((g) => !!g);
  const listGameIds = new Set(listGames.map((g) => g.id));

  const current = await prisma.eventGame.findMany({
    where: { eventId },
    select: { id: true, gameId: true, fromGeeklist: true, leftGeeklistAt: true, _count: { select: { interests: true } } },
  });
  // Una lista que se queda vacía de golpe huele a fallo de BGG: mejor no
  // vaciar la ludoteca por ello
  if (listGames.length === 0 && current.some((c) => c.fromGeeklist && !c.leftGeeklistAt)) {
    throw new Error("BGG ha devuelto la lista vacía. No hemos tocado los juegos; vuelve a probar más tarde.");
  }
  const currentGameIds = new Set(current.map((c) => c.gameId));

  const newGames = listGames.filter((g) => !currentGameIds.has(g.id));
  if (newGames.length > 0) {
    await prisma.eventGame.createMany({
      data: newGames.map((g) => ({
        eventId,
        gameId: g.id,
        addedById: actorId ?? event.createdById,
        fromGeeklist: true,
      })),
      skipDuplicates: true,
    });
  }

  // Los que ya estaban (a mano o porque volvieron a la lista) pasan a ser de
  // la lista. Sus intereses siguen donde estaban.
  await prisma.eventGame.updateMany({
    where: {
      eventId,
      gameId: { in: [...listGameIds] },
      OR: [{ fromGeeklist: false }, { leftGeeklistAt: { not: null } }],
    },
    data: { fromGeeklist: true, leftGeeklistAt: null },
  });

  const gone = current.filter((c) => !listGameIds.has(c.gameId));
  // Se vuelve a mirar al borrar: alguien puede marcar interés entretanto
  const { count: removed } = await prisma.eventGame.deleteMany({
    where: {
      id: { in: gone.filter((c) => c._count.interests === 0).map((c) => c.id) },
      interests: { none: {} },
    },
  });
  const toFlag = gone.filter((c) => c._count.interests > 0 && !c.leftGeeklistAt).map((c) => c.id);
  if (toFlag.length > 0) {
    await prisma.eventGame.updateMany({ where: { id: { in: toFlag } }, data: { leftGeeklistAt: new Date() } });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { geeklistTitle: list.title || null, geeklistSyncedAt: new Date(), geeklistError: null },
  });

  if (newGames.length > 0) {
    if (actorId) {
      logActivity("event_geeklist_synced", actorId, {
        eventId,
        listTitle: list.title,
        added: newGames.length,
      });
    }

    // Quien va al evento se entera de lo que llega a la ludoteca. Ráfagas
    // seguidas se juntan en un aviso (ver notify).
    prisma.eventAttendee
      .findMany({ where: { eventId, status: { not: "cancelled" } }, select: { userId: true } })
      .then((attendees) =>
        notify({
          type: "event_geeklist_games",
          userIds: [event.createdById, ...attendees.map((a) => a.userId)],
          actorId,
          eventId,
          metadata: {
            games: newGames.slice(0, 20).map((g) => ({ name: g.name, thumbnail: g.thumbnail })),
            count: newGames.length,
          },
        })
      )
      .catch(() => {});
  }

  return {
    title: list.title,
    total: listGames.length,
    added: newGames.length,
    removed,
    flagged: toFlag.length,
  };
}

/**
 * Reserva el turno de importar: false si otro lo ha intentado hace menos de
 * `minGapMs` (dos visitas a la vez no tiran dos veces de BGG).
 */
async function claimSync(eventId: string, minGapMs: number): Promise<boolean> {
  const { count } = await prisma.event.updateMany({
    where: {
      id: eventId,
      bggGeeklistId: { not: null },
      OR: [{ geeklistCheckedAt: null }, { geeklistCheckedAt: { lt: new Date(Date.now() - minGapMs) } }],
    },
    data: { geeklistCheckedAt: new Date() },
  });
  return count > 0;
}

/**
 * Reimporta la lista vinculada. null si no tocaba (sin lista o importada
 * hace nada). Si BGG falla, guarda el motivo en el evento y lanza el error.
 */
export async function syncEventGeeklist(
  eventId: string,
  { actorId = null, minGapMs = GEEKLIST_MANUAL_GAP_MS }: { actorId?: string | null; minGapMs?: number } = {}
): Promise<GeeklistSyncResult | null> {
  if (!(await claimSync(eventId, minGapMs))) return null;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { bggGeeklistId: true } });
  if (!event?.bggGeeklistId) return null;

  try {
    const list = await fetchBggGeeklist(event.bggGeeklistId);
    return await applyGeeklist(eventId, list, actorId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo leer la lista de BGG.";
    await prisma.event.update({ where: { id: eventId }, data: { geeklistError: message } }).catch(() => {});
    throw err;
  }
}

/** Al abrir un evento con lista: si toca, la reimporta después de responder. */
export function refreshGeeklistIfStale(event: {
  id: string;
  date: Date;
  endDate: Date | null;
  bggGeeklistId: number | null;
  geeklistCheckedAt: Date | null;
}) {
  if (!event.bggGeeklistId || isEventOver(event)) return;
  const checked = event.geeklistCheckedAt?.getTime() ?? 0;
  if (Date.now() - checked < GEEKLIST_REFRESH_MS) return;
  inBackground(() => syncEventGeeklist(event.id, { minGapMs: GEEKLIST_REFRESH_MS }));
}
