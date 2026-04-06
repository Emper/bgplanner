import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

  // All activity (public + internal) for this group
  const activities = await prisma.activityLog.findMany({
    where: {
      groupId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const hasMore = activities.length > limit;
  const items = activities.slice(0, limit);
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({ items, nextCursor });
}
