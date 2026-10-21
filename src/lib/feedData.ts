import { prisma } from "./prisma";
import { paginate } from "./api";
import { withGameCovers } from "./activityCovers";
import { PUBLIC_USER_SELECT } from "./users";

/** Límites de página del feed del inicio (los de `parsePage`). */
export const MY_FEED_PAGE = { defaultLimit: 20, max: 50 };

/**
 * Lo que ha pasado en los grupos y eventos de alguien, de lo más reciente
 * hacia atrás. La usan GET /api/feed y el inicio pintado en el servidor.
 */
export async function getMyFeed(userId: string, { limit, cursor }: { limit: number; cursor: Date | null }) {
  const [memberships, attendances] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    }),
    prisma.eventAttendee.findMany({
      where: { userId },
      select: { eventId: true },
    }),
  ]);

  const groupIds = memberships.map((m) => m.groupId);
  const eventIds = attendances.map((a) => a.eventId);

  const activities = await prisma.activityLog.findMany({
    where: {
      scope: "public",
      OR: [{ groupId: { in: groupIds } }, { eventId: { in: eventIds } }],
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // uno de más para saber si hay otra página
    include: {
      user: { select: PUBLIC_USER_SELECT },
      group: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
    },
  });

  const { items, nextCursor } = paginate(activities, limit);
  return { items: await withGameCovers(items), nextCursor };
}
