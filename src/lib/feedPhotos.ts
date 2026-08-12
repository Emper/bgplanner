import { prisma } from "./prisma";

// ── Fotos de galería en el feed ─────────────────────────────────────────────
//
// Las fotos sueltas de galería (de grupo y de evento) NO se sirven a partir de
// su registro de actividad, sino leyéndolas directamente de las tablas
// GroupPhoto / EventPhoto. Motivo: logActivity es fire-and-forget y en
// serverless la escritura puede perderse si la función se congela tras
// responder, dejando fotos que existen pero sin entrada de actividad. Leer de
// la tabla viva garantiza que toda foto aparece (retroactivo, sin migrar) y que
// una foto borrada deja de mostrarse. Los feeds excluyen los tipos
// group_photo_added / event_photo_added del activity log para no duplicar.
//
// Las opiniones (game_reviewed) sí siguen viniendo del activity log; sus fotos
// se resuelven con attachReviewPhotos. (A futuro, si hiciera falta, se podrían
// servir también desde GameReview por el mismo motivo de fiabilidad.)

export interface FeedPhoto {
  id: string;
  url: string;
}

interface FeedUser {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

// Ítem de feed sintético para una tanda de fotos de galería.
export interface GalleryFeedItem {
  id: string;
  type: "group_photo_added" | "event_photo_added";
  scope: "public";
  userId: string;
  metadata: { photoCount: number };
  createdAt: Date;
  photos: FeedPhoto[];
  user: FeedUser;
  group?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
}

const USER_SELECT = { id: true, name: true, displayName: true, avatarUrl: true } as const;

// Máximo de fotos a traer por ámbito (grupo/evento) al construir el feed.
const GALLERY_FETCH_CAP = 500;
// Fotos mostradas por ítem (tanda). La galería completa está en su pestaña.
const MAX_PHOTOS_PER_ITEM = 8;
// Ventana para agrupar en una sola tanda las fotos que un usuario sube juntas.
const BUCKET_MS = 10 * 60 * 1000;

interface RawPhoto {
  id: string;
  url: string;
  userId: string;
  createdAt: Date;
  user: FeedUser;
  scopeId: string;
  context?: { id: string; name: string } | null;
}

// Agrupa las fotos de un mismo usuario y ámbito subidas en la misma ventana
// temporal en un único ítem de feed (bucket alineado al reloj, determinista).
function bucketize(
  photos: RawPhoto[],
  type: GalleryFeedItem["type"],
  withContext: boolean
): GalleryFeedItem[] {
  const groups = new Map<string, RawPhoto[]>();
  for (const p of photos) {
    const bucket = Math.floor(p.createdAt.getTime() / BUCKET_MS);
    const key = `${p.scopeId}:${p.userId}:${bucket}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  const items: GalleryFeedItem[] = [];
  for (const [key, arr] of groups) {
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const first = arr[0];
    const ctx = withContext ? first.context ?? null : null;
    items.push({
      id: `gphoto-${type === "group_photo_added" ? "g" : "e"}-${key}`,
      type,
      scope: "public",
      userId: first.userId,
      metadata: { photoCount: arr.length },
      createdAt: first.createdAt,
      photos: arr.slice(0, MAX_PHOTOS_PER_ITEM).map((p) => ({ id: p.id, url: p.url })),
      user: first.user,
      group: type === "group_photo_added" ? ctx : null,
      event: type === "event_photo_added" ? ctx : null,
    });
  }
  return items;
}

// Construye los ítems de feed de fotos de galería para los grupos y/o eventos
// indicados. `withContext` incluye el grupo/evento de origen (para el feed
// general, que mezcla ámbitos). Devuelve ordenado por fecha descendente.
export async function buildGalleryPhotoItems(opts: {
  groupIds?: string[];
  eventIds?: string[];
  withContext?: boolean;
}): Promise<GalleryFeedItem[]> {
  const { groupIds = [], eventIds = [], withContext = false } = opts;
  const items: GalleryFeedItem[] = [];

  await Promise.all([
    (async () => {
      if (groupIds.length === 0) return;
      const rows = await prisma.groupPhoto.findMany({
        where: { groupId: { in: groupIds } },
        orderBy: { createdAt: "desc" },
        take: GALLERY_FETCH_CAP,
        select: {
          id: true,
          url: true,
          userId: true,
          createdAt: true,
          groupId: true,
          user: { select: USER_SELECT },
          group: { select: { id: true, name: true } },
        },
      });
      const raw: RawPhoto[] = rows.map((r) => ({
        id: r.id,
        url: r.url,
        userId: r.userId,
        createdAt: r.createdAt,
        user: r.user,
        scopeId: r.groupId,
        context: r.group,
      }));
      items.push(...bucketize(raw, "group_photo_added", withContext));
    })(),
    (async () => {
      if (eventIds.length === 0) return;
      const rows = await prisma.eventPhoto.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { createdAt: "desc" },
        take: GALLERY_FETCH_CAP,
        select: {
          id: true,
          url: true,
          userId: true,
          createdAt: true,
          eventId: true,
          user: { select: USER_SELECT },
          event: { select: { id: true, name: true } },
        },
      });
      const raw: RawPhoto[] = rows.map((r) => ({
        id: r.id,
        url: r.url,
        userId: r.userId,
        createdAt: r.createdAt,
        user: r.user,
        scopeId: r.eventId,
        context: r.event,
      }));
      items.push(...bucketize(raw, "event_photo_added", withContext));
    })(),
  ]);

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}

// ── Fusión con el activity log + paginación por cursor ──────────────────────

interface Timestamped {
  createdAt: Date;
}

// Fusiona ítems de actividad y de galería (ambos ordenados desc por fecha),
// aplica el cursor (createdAt < cursor) y devuelve una página de `limit`
// elementos junto al cursor siguiente. Se sobre-lee limit+1 de la actividad y
// todas las fotos, así que el corte global es correcto.
export function mergeFeed<A extends Timestamped, G extends Timestamped>(
  activities: A[],
  gallery: G[],
  cursor: string | null,
  limit: number
): { items: (A | G)[]; nextCursor: string | null } {
  const cutoff = cursor ? new Date(cursor).getTime() : null;
  const pool: (A | G)[] = [...activities, ...gallery].filter(
    (i) => cutoff === null || i.createdAt.getTime() < cutoff
  );
  pool.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const hasMore = pool.length > limit;
  const items = pool.slice(0, limit);
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;
  return { items, nextCursor };
}

// ── Enriquecer opiniones (game_reviewed) con sus fotos ──────────────────────

export interface ReviewEnrichable {
  id: string;
  type: string;
  userId: string;
  groupId?: string | null;
  createdAt: Date;
  photos?: FeedPhoto[];
}

const EPSILON_MS = 3000;

// Adjunta a cada actividad game_reviewed las fotos de su opinión, resueltas en
// lectura desde GameReview (retroactivo, y una foto borrada desaparece). El
// enlace es por (grupo + usuario + cercanía temporal), emparejando 1-a-1 en
// orden cronológico, porque la actividad se registra junto a la opinión.
export async function attachReviewPhotos<T extends ReviewEnrichable>(items: T[]): Promise<T[]> {
  const reviewActs = items.filter((i) => i.type === "game_reviewed" && i.groupId);
  if (reviewActs.length === 0) return items;

  const groupIds = [...new Set(reviewActs.map((i) => i.groupId as string))];
  const userIds = [...new Set(reviewActs.map((i) => i.userId))];
  const reviews = await prisma.gameReview.findMany({
    where: { userId: { in: userIds }, groupGame: { groupId: { in: groupIds } } },
    select: {
      userId: true,
      createdAt: true,
      groupGame: { select: { groupId: true } },
      photos: { orderBy: { order: "asc" }, select: { id: true, url: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byBucket = new Map<string, { acts: T[]; reviews: typeof reviews }>();
  for (const a of reviewActs) {
    const k = `${a.groupId}:${a.userId}`;
    let b = byBucket.get(k);
    if (!b) { b = { acts: [], reviews: [] }; byBucket.set(k, b); }
    b.acts.push(a);
  }
  for (const r of reviews) {
    byBucket.get(`${r.groupGame.groupId}:${r.userId}`)?.reviews.push(r);
  }
  for (const { acts, reviews: revs } of byBucket.values()) {
    acts.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
    const sortedRevs = [...revs].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
    let ptr = 0;
    for (const a of acts) {
      const cutoff = a.createdAt.getTime() + EPSILON_MS;
      while (ptr < sortedRevs.length && sortedRevs[ptr].createdAt.getTime() > cutoff) ptr++;
      const r = sortedRevs[ptr];
      if (r) {
        ptr++;
        if (r.photos.length) a.photos = r.photos.slice(0, MAX_PHOTOS_PER_ITEM);
      }
    }
  }
  return items;
}
