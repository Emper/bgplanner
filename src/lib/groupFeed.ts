import { prisma } from "@/lib/prisma";
import { paginate, requireGroupMember } from "@/lib/api";
import { withGameCovers } from "@/lib/activityCovers";
import { PUBLIC_USER_SELECT } from "@/lib/users";

/** Lo que pide el cliente por página (`?limit=30`); también la primera del servidor. */
export const GROUP_FEED_LIMIT = 30;

// Una página del feed de un grupo: toda su actividad (pública e interna).
// Lo usan /api/groups/[id]/feed y la página de servidor. Lanza ApiError 403
// si no eres miembro.
export async function getGroupFeed(
  groupId: string,
  userId: string,
  { limit, cursor }: { limit: number; cursor: Date | null }
) {
  // La membresía y la consulta a la vez: si no eres miembro, Promise.all
  // rechaza con el 403 y lo leído se tira.
  const [, activities] = await Promise.all([
    requireGroupMember(groupId, userId),
    prisma.activityLog.findMany({
      where: {
        groupId,
        ...(cursor ? { createdAt: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: { user: { select: PUBLIC_USER_SELECT } },
    }),
  ]);

  const { items, nextCursor } = paginate(activities, limit);
  return { items: await withGameCovers(items), nextCursor };
}
