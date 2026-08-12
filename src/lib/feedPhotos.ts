import { prisma } from "./prisma";

// Resuelve las fotos reales asociadas a los ítems de actividad de tipo foto u
// opinión y se las adjunta, leyéndolas en el momento desde las tablas de fotos
// (GroupPhoto / EventPhoto / GameReviewPhoto). Ventajas de resolver en lectura
// en vez de guardar las URLs en la metadata de la actividad:
//   - Retroactivo: funciona con fotos y opiniones ya existentes, sin migrar.
//   - Correcto: si una foto se borra, desaparece del feed automáticamente.
//   - Sin cambios de esquema ni escrituras en la BD.
//
// El enlace actividad→fotos se hace por (ámbito + usuario + cercanía temporal),
// porque la actividad se registra en la misma petición justo después de crear
// las fotos/opinión (sus createdAt quedan a pocos ms/seg). Las actividades de
// un mismo bucket (mismo grupo/evento y usuario) se reparten las fotos en orden
// cronológico, acotando cada una por su `photoCount`, de modo que subidas
// secuenciales no se mezclan.

export interface FeedPhoto {
  id: string;
  url: string;
}

export interface PhotoEnrichable {
  id: string;
  type: string;
  userId: string;
  groupId?: string | null;
  eventId?: string | null;
  createdAt: Date;
  metadata: unknown;
  photos?: FeedPhoto[];
}

// Cuántas miniaturas resolvemos como máximo por actividad (el feed además
// recorta lo que muestra). Evita traer galerías enteras a un solo ítem.
const MAX_PHOTOS_PER_ITEM = 8;

// Holgura para el "created antes que la actividad": la actividad se escribe tras
// las fotos, así que sus createdAt son <= el de la actividad. Un pequeño margen
// cubre el redondeo y cualquier desfase de reloj.
const EPSILON_MS = 3000;

function photoCountOf(metadata: unknown): number {
  if (metadata && typeof metadata === "object") {
    const c = (metadata as Record<string, unknown>).photoCount;
    if (typeof c === "number" && c > 0) return c;
  }
  return 1;
}

interface PhotoRow {
  id: string;
  url: string;
  scopeKey: string; // `${scopeId}:${userId}`
  createdAt: Date;
}

// Reparte, dentro de un bucket (mismo grupo/evento + usuario), las fotos entre
// sus actividades en orden cronológico descendente: la actividad más reciente
// toma las fotos más recientes (acotada por su photoCount), y así hacia atrás.
function assignByBucket(
  acts: PhotoEnrichable[],
  photos: PhotoRow[],
  countFor: (a: PhotoEnrichable) => number
) {
  const byBucket = new Map<string, { acts: PhotoEnrichable[]; photos: PhotoRow[] }>();
  const keyOf = (a: PhotoEnrichable) => `${a.groupId || a.eventId || ""}:${a.userId}`;

  for (const a of acts) {
    const k = keyOf(a);
    let b = byBucket.get(k);
    if (!b) { b = { acts: [], photos: [] }; byBucket.set(k, b); }
    b.acts.push(a);
  }
  for (const p of photos) {
    const b = byBucket.get(p.scopeKey);
    if (b) b.photos.push(p);
  }

  for (const { acts: bucketActs, photos: bucketPhotos } of byBucket.values()) {
    bucketActs.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
    bucketPhotos.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
    let ptr = 0;
    for (const a of bucketActs) {
      const limit = Math.min(countFor(a), MAX_PHOTOS_PER_ITEM);
      const cutoff = a.createdAt.getTime() + EPSILON_MS;
      const assigned: FeedPhoto[] = [];
      while (ptr < bucketPhotos.length && assigned.length < limit) {
        const p = bucketPhotos[ptr];
        ptr++;
        if (p.createdAt.getTime() <= cutoff) assigned.push({ id: p.id, url: p.url });
      }
      if (assigned.length) a.photos = assigned;
    }
  }
}

export async function attachFeedPhotos<T extends PhotoEnrichable>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;

  const groupPhotoActs = items.filter((i) => i.type === "group_photo_added" && i.groupId);
  const eventPhotoActs = items.filter((i) => i.type === "event_photo_added" && i.eventId);
  const reviewActs = items.filter((i) => i.type === "game_reviewed" && i.groupId);

  await Promise.all([
    // ── Fotos sueltas de galería de grupo ────────────────────────────────
    (async () => {
      if (groupPhotoActs.length === 0) return;
      const groupIds = [...new Set(groupPhotoActs.map((i) => i.groupId as string))];
      const userIds = [...new Set(groupPhotoActs.map((i) => i.userId))];
      const rows = await prisma.groupPhoto.findMany({
        where: { groupId: { in: groupIds }, userId: { in: userIds } },
        select: { id: true, url: true, groupId: true, userId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      assignByBucket(
        groupPhotoActs,
        rows.map((r) => ({ id: r.id, url: r.url, scopeKey: `${r.groupId}:${r.userId}`, createdAt: r.createdAt })),
        (a) => photoCountOf(a.metadata)
      );
    })(),
    // ── Fotos sueltas de galería de evento ───────────────────────────────
    (async () => {
      if (eventPhotoActs.length === 0) return;
      const eventIds = [...new Set(eventPhotoActs.map((i) => i.eventId as string))];
      const userIds = [...new Set(eventPhotoActs.map((i) => i.userId))];
      const rows = await prisma.eventPhoto.findMany({
        where: { eventId: { in: eventIds }, userId: { in: userIds } },
        select: { id: true, url: true, eventId: true, userId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      assignByBucket(
        eventPhotoActs,
        rows.map((r) => ({ id: r.id, url: r.url, scopeKey: `${r.eventId}:${r.userId}`, createdAt: r.createdAt })),
        (a) => photoCountOf(a.metadata)
      );
    })(),
    // ── Fotos adjuntas a una opinión de juego ────────────────────────────
    (async () => {
      if (reviewActs.length === 0) return;
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
      // Empareja cada actividad con la opinión del mismo bucket más cercana en
      // el tiempo (una opinión por creación → createdAt ≈ el de la actividad),
      // y usa sus fotos. Se empareja 1-a-1 en orden cronológico.
      const byBucket = new Map<string, { acts: PhotoEnrichable[]; reviews: typeof reviews }>();
      for (const a of reviewActs) {
        const k = `${a.groupId}:${a.userId}`;
        let b = byBucket.get(k);
        if (!b) { b = { acts: [], reviews: [] }; byBucket.set(k, b); }
        b.acts.push(a);
      }
      for (const r of reviews) {
        const k = `${r.groupGame.groupId}:${r.userId}`;
        byBucket.get(k)?.reviews.push(r);
      }
      for (const { acts, reviews: revs } of byBucket.values()) {
        acts.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
        const sortedRevs = [...revs].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
        // Recorre en orden descendente: cada actividad toma la siguiente opinión
        // creada en su mismo momento o antes (createdAt <= actividad), 1-a-1.
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
    })(),
  ]);

  return items;
}
