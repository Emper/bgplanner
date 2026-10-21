import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withGameCovers } from "@/lib/activityCovers";
import { apiHandler, paginate, parsePage, requireEventAccess, requireSession } from "@/lib/api";

// Actividad del evento, paginada por cursor. La de un evento privado es solo
// para quien puede verlo.
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: eventId } = await params;

    await requireEventAccess(eventId, session.userId, "view");

    const { limit, cursor } = parsePage(request.nextUrl.searchParams);

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

    return NextResponse.json({ items: await withGameCovers(items), nextCursor });
  }
);
