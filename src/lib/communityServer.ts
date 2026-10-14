import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { truncateChars } from "./text";

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
