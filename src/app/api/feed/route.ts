import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, paginate, parsePage, requireSession } from "@/lib/api";
import { withGameCovers } from "@/lib/activityCovers";
import { PUBLIC_USER_SELECT } from "@/lib/users";

// Lo que ha pasado en mis grupos y eventos, de lo más reciente hacia atrás.
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { limit, cursor } = parsePage(request.nextUrl.searchParams, { defaultLimit: 20, max: 50 });

  const [memberships, attendances] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: session.userId },
      select: { groupId: true },
    }),
    prisma.eventAttendee.findMany({
      where: { userId: session.userId },
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
  return NextResponse.json({ items: await withGameCovers(items), nextCursor });
});
