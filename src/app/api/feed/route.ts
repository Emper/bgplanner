import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { attachReviewPhotos, buildGalleryPhotoItems, mergeFeed } from "@/lib/feedPhotos";

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

  // Actividad pública de los grupos y eventos del usuario. Las fotos de galería
  // se sirven aparte desde su tabla (ver feedPhotos), así que se excluyen aquí.
  const [activities, gallery] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        scope: "public",
        type: { notIn: ["group_photo_added", "event_photo_added"] },
        OR: [
          { groupId: { in: groupIds } },
          { eventId: { in: eventIds } },
        ],
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // +1 to know if there are more
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        group: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
      },
    }),
    buildGalleryPhotoItems({ groupIds, eventIds, withContext: true }),
  ]);

  await attachReviewPhotos(activities);

  const { items, nextCursor } = mergeFeed(activities, gallery, cursor, limit);

  return NextResponse.json({ items, nextCursor });
}
