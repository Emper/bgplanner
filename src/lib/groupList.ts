import { prisma } from "./prisma";

/**
 * Los grupos de alguien, con lo que pinta su lista (inicio, /groups): los
 * fijados primero y, dentro de cada bloque, del más nuevo al más viejo.
 * La usan GET /api/groups y el inicio pintado en el servidor.
 */
export async function listMyGroups(userId: string) {
  // Se parte de las membresías de quien llama: así el «fijado» (que es suyo,
  // no del grupo) llega en la misma consulta.
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: {
      pinned: true,
      group: {
        include: {
          _count: { select: { members: true, games: { where: { archivedAt: null } } } },
          members: {
            include: { user: { select: { name: true, displayName: true, avatarUrl: true } } },
            take: 5,
          },
        },
      },
    },
    orderBy: { group: { createdAt: "desc" } },
  });

  // Los fijados primero; dentro de cada bloque, del más nuevo al más viejo.
  return memberships
    .map((m) => ({ ...m.group, pinned: m.pinned }))
    .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
}
