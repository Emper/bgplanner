import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, paginate, parsePage, requireSession } from "@/lib/api";
import { NOTIFICATION_SELECT, presentNotification } from "@/lib/notifications";

/** Mis notificaciones, de la más reciente a la más antigua. */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { limit, cursor } = parsePage(request.nextUrl.searchParams, { defaultLimit: 20, max: 50 });

  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: session.userId,
        ...(cursor ? { createdAt: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
  ]);

  const { items, nextCursor } = paginate(rows, limit);
  return NextResponse.json({ items: items.map(presentNotification), unread, nextCursor });
});
