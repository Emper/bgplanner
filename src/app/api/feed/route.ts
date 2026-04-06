import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const cursor = url.searchParams.get("cursor"); // createdAt ISO string for pagination

  // Get user's group IDs and event IDs
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

  // Fetch public activity from user's groups and events
  const activities = await prisma.activityLog.findMany({
    where: {
      scope: "public",
      OR: [
        { groupId: { in: groupIds } },
        { eventId: { in: eventIds } },
      ],
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // +1 to know if there are more
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      group: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
    },
  });

  const hasMore = activities.length > limit;
  const items = activities.slice(0, limit);
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({ items, nextCursor });
}
