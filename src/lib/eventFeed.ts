import { prisma } from "@/lib/prisma";
import { paginate, requireEventAccess } from "@/lib/api";
import { withGameCovers } from "@/lib/activityCovers";

/** Lo que pide el cliente por página (`?limit=30`); también la primera del servidor. */
export const EVENT_FEED_LIMIT = 30;

// Una página de la actividad del evento. La de un evento privado es solo para
// quien puede verlo: si no, ApiError 404. La usan /api/events/[id]/feed y la
// página de servidor del evento.
export async function getEventFeed(
  eventId: string,
  userId: string,
  { limit, cursor }: { limit: number; cursor: Date | null }
) {
  await requireEventAccess(eventId, userId, "view");

  const activities = await prisma.activityLog.findMany({
    where: {
      eventId,
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true, slug: true } },
    },
  });

  const { items, nextCursor } = paginate(activities, limit);

  return { items: await withGameCovers(items), nextCursor };
}
