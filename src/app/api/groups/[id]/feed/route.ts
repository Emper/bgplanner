import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, paginate, parsePage, requireGroupMember, requireSession } from "@/lib/api";
import { withGameCovers } from "@/lib/activityCovers";
import { PUBLIC_USER_SELECT } from "@/lib/users";

export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: groupId } = await params;

    await requireGroupMember(groupId, session.userId);

    const { limit, cursor } = parsePage(request.nextUrl.searchParams);

    // Toda la actividad del grupo (pública e interna)
    const activities = await prisma.activityLog.findMany({
      where: {
        groupId,
        ...(cursor ? { createdAt: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: { user: { select: PUBLIC_USER_SELECT } },
    });

    const { items, nextCursor } = paginate(activities, limit);
    return NextResponse.json({ items: await withGameCovers(items), nextCursor });
  }
);
