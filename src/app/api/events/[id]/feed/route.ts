import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { withGameCovers } from "@/lib/activityCovers";
import { getEventParticipation } from "@/lib/events";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  // La actividad de un evento privado es solo para quien puede verlo.
  const p = await getEventParticipation(eventId, session.userId);
  if (!p?.canView) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 50);
  const cursor = url.searchParams.get("cursor");

  const activities = await prisma.activityLog.findMany({
    where: {
      eventId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true, slug: true } },
    },
  });

  const hasMore = activities.length > limit;
  const items = activities.slice(0, limit);
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({ items: await withGameCovers(items), nextCursor });
}
