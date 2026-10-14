import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { truncateChars } from "./text";
import { THREADS_PAGE_SIZE } from "./community";

// Lo único que se enseña del autor de un hilo o respuesta: el foro se lee sin
// cuenta, así que nunca sale el email.
export const AUTHOR_SELECT = {
  id: true,
  slug: true,
  name: true,
  displayName: true,
  avatarUrl: true,
} as const;

export function publicAuthor(user: {
  id: string;
  slug: string | null;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    slug: user.slug,
    name: user.displayName || user.name || "Jugador",
    avatarUrl: user.avatarUrl,
  };
}

// Anti-spam sencillo: cuántas cosas ha publicado alguien en la última ventana.
export async function countRecentThreads(userId: string, minutes: number) {
  return prisma.communityThread.count({
    where: { authorId: userId, createdAt: { gte: new Date(Date.now() - minutes * 60000) } },
  });
}

export async function countRecentReplies(userId: string, minutes: number) {
  return prisma.communityReply.count({
    where: { authorId: userId, createdAt: { gte: new Date(Date.now() - minutes * 60000) } },
  });
}

// Hilo visible (no borrado) con lo mínimo para comprobar permisos.
export function findLiveThread(id: string) {
  return prisma.communityThread.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, authorId: true },
  });
}

// ── Listados ────────────────────────────────────────────────────────────

const EXCERPT_CHARS = 220;
export const THREAD_LIST_SELECT = {
  id: true,
  title: true,
  body: true,
  tag: true,
  pinned: true,
  createdAt: true,
  lastActivityAt: true,
  author: { select: AUTHOR_SELECT },
  _count: { select: { replies: { where: { deletedAt: null } } } },
  replies: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true, author: { select: AUTHOR_SELECT } },
  },
} satisfies Prisma.CommunityThreadSelect;

export type ThreadListRow = Prisma.CommunityThreadGetPayload<{ select: typeof THREAD_LIST_SELECT }>;

export function toThreadListItem(t: ThreadListRow) {
  const last = t.replies[0];
  return {
    id: t.id,
    title: t.title,
    excerpt: truncateChars(t.body.replace(/\s+/g, " ").trim(), EXCERPT_CHARS),
    tag: t.tag,
    pinned: t.pinned,
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt,
    author: publicAuthor(t.author),
    replyCount: t._count.replies,
    lastReply: last ? { createdAt: last.createdAt, author: publicAuthor(last.author) } : null,
  };
}

export type ThreadListItem = ReturnType<typeof toThreadListItem>;

/**
 * Los hilos con movimiento más reciente, fijados incluidos como uno más: para
 * escaparates (portada, inicio) donde un hilo de normas fijo arriba no aporta.
 */
export async function getLatestThreads(limit: number) {
  const rows = await prisma.communityThread.findMany({
    where: { deletedAt: null },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: limit,
    select: THREAD_LIST_SELECT,
  });
  return rows.map(toThreadListItem);
}

// El cursor es "<lastActivityAt ISO>_<id>": la fecha sola puede repetirse.
export function parseThreadCursor(raw: string | null | undefined) {
  if (!raw) return null;
  const sep = raw.lastIndexOf("_");
  if (sep <= 0) return null;
  const date = new Date(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (Number.isNaN(date.getTime()) || !id) return null;
  return { date, id };
}

/**
 * Una página del listado del foro. Los fijados van arriba en la primera
 * página (salvo al buscar, que compiten como uno más); el resto, por última
 * actividad. La usan la API y la página de servidor, para que lo que ve un
 * buscador sea lo mismo que ve quien navega.
 */
export async function listThreads({
  tag,
  q,
  cursor: rawCursor,
}: {
  tag?: string | null;
  q?: string | null;
  cursor?: string | null;
}) {
  const query = (q || "").trim().slice(0, 100);
  const cursor = parseThreadCursor(rawCursor);
  const base: Prisma.CommunityThreadWhereInput = {
    deletedAt: null,
    ...(tag ? { tag } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { body: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const separatePinned = !query;

  const [pinned, rows, tagCounts] = await Promise.all([
    separatePinned && !cursor
      ? prisma.communityThread.findMany({
          where: { ...base, pinned: true },
          orderBy: { lastActivityAt: "desc" },
          select: THREAD_LIST_SELECT,
        })
      : Promise.resolve([] as ThreadListRow[]),
    prisma.communityThread.findMany({
      where: {
        ...base,
        ...(separatePinned ? { pinned: false } : {}),
        ...(cursor
          ? {
              AND: [
                {
                  OR: [
                    { lastActivityAt: { lt: cursor.date } },
                    { lastActivityAt: cursor.date, id: { lt: cursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      take: THREADS_PAGE_SIZE + 1,
      select: THREAD_LIST_SELECT,
    }),
    // Cuántos hilos hay por etiqueta, para los filtros. Solo en la primera
    // página: luego no cambia.
    cursor
      ? Promise.resolve(null)
      : prisma.communityThread.groupBy({
          by: ["tag"],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
  ]);

  const hasMore = rows.length > THREADS_PAGE_SIZE;
  const page = rows.slice(0, THREADS_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    threads: [...pinned, ...page].map(toThreadListItem),
    nextCursor: hasMore && last ? `${last.lastActivityAt.toISOString()}_${last.id}` : null,
    tagCounts: tagCounts
      ? (Object.fromEntries(tagCounts.map((c) => [c.tag, c._count._all])) as Record<string, number>)
      : undefined,
  };
}

// Tope de respuestas que se devuelven de una vez. Holgado para un foro de
// este tamaño; si algún hilo lo roza, toca paginar.
const MAX_REPLIES = 500;

/**
 * Un hilo con sus respuestas en orden. Las borradas van sin texto ni autor
 * para que quede su hueco en la conversación. null si no existe o se borró.
 */
export async function getThreadDetail(id: string) {
  const thread = await prisma.communityThread.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      body: true,
      tag: true,
      pinned: true,
      createdAt: true,
      editedAt: true,
      author: { select: AUTHOR_SELECT },
      replies: {
        orderBy: { createdAt: "asc" },
        take: MAX_REPLIES,
        select: {
          id: true,
          body: true,
          createdAt: true,
          editedAt: true,
          deletedAt: true,
          author: { select: AUTHOR_SELECT },
        },
      },
    },
  });
  if (!thread) return null;
  return {
    thread: {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      tag: thread.tag,
      pinned: thread.pinned,
      createdAt: thread.createdAt,
      editedAt: thread.editedAt,
      author: publicAuthor(thread.author),
    },
    replies: thread.replies.map((r) =>
      r.deletedAt
        ? { id: r.id, deleted: true as const, createdAt: r.createdAt }
        : {
            id: r.id,
            deleted: false as const,
            body: r.body,
            createdAt: r.createdAt,
            editedAt: r.editedAt,
            author: publicAuthor(r.author),
          }
    ),
  };
}

export type ThreadDetail = NonNullable<Awaited<ReturnType<typeof getThreadDetail>>>;

/** Da por vistos los avisos de respuestas de un hilo. Devuelve los no leídos que quedan, o null si no había nada que marcar. */
export async function markThreadNotificationsRead(userId: string, threadId: string) {
  const marked = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      type: { in: ["community_reply", "community_participant_reply"] },
      metadata: { path: ["threadId"], equals: threadId },
    },
    data: { readAt: new Date() },
  });
  if (marked.count === 0) return null;
  return prisma.notification.count({ where: { userId, readAt: null } });
}
