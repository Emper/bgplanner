import { prisma } from "./prisma";

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
