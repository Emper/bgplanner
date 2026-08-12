import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildGalleryPhotoItems, mergeFeed } from "@/lib/feedPhotos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 50);
  const cursor = url.searchParams.get("cursor");

  // Las fotos de galería del evento se sirven aparte desde su tabla; se
  // excluyen del activity log aquí para no duplicar.
  const [activities, gallery] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        eventId,
        type: { not: "event_photo_added" },
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
      },
    }),
    buildGalleryPhotoItems({ eventIds: [eventId] }),
  ]);

  const { items, nextCursor } = mergeFeed(activities, gallery, cursor, limit);

  return NextResponse.json({ items, nextCursor });
}
