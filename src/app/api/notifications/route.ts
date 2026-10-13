import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NOTIFICATION_SELECT, presentNotification } from "@/lib/notifications";

/** Mis notificaciones, de la más reciente a la más antigua. */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20") || 20, 1), 50);
  const cursor = url.searchParams.get("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;

  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: session.userId,
        ...(cursorDate && !isNaN(cursorDate.getTime()) ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
  ]);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({ items: items.map(presentNotification), unread, nextCursor });
}
