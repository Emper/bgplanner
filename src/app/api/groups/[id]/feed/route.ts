import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { attachReviewPhotos, buildGalleryPhotoItems, mergeFeed } from "@/lib/feedPhotos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  // Check membership
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 50);
  const cursor = url.searchParams.get("cursor");

  // All activity (public + internal) for this group. Las fotos de galería se
  // sirven aparte desde su tabla (ver feedPhotos), así que se excluyen aquí.
  const [activities, gallery] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        groupId,
        type: { not: "group_photo_added" },
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
      },
    }),
    buildGalleryPhotoItems({ groupIds: [groupId] }),
  ]);

  await attachReviewPhotos(activities);

  const { items, nextCursor } = mergeFeed(activities, gallery, cursor, limit);

  return NextResponse.json({ items, nextCursor });
}
