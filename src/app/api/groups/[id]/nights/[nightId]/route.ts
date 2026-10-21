import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireGroupMember, requireSession } from "@/lib/api";
import { isGroupManager } from "@/lib/groupTypes";

// Borra una noche entera o, con ?gameId=, solo uno de sus juegos (si era el
// último, se va la noche). Lo jugado sigue marcado: se devuelve a pendientes
// desde el ranking.
export const DELETE = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; nightId: string }> }
  ) => {
    const session = await requireSession(request);
    const { id: groupId, nightId } = await params;
    const gameId = request.nextUrl.searchParams.get("gameId");

    const [membership, night] = await Promise.all([
      requireGroupMember(groupId, session.userId),
      prisma.gameNight.findFirst({
        where: { id: nightId, groupId },
        select: { id: true, createdById: true, _count: { select: { games: true } } },
      }),
    ]);

    if (!night) throw new ApiError(404, "Sesión no encontrada");

    if (!isGroupManager(membership.role) && night.createdById !== session.userId) {
      throw new ApiError(403, "Solo quien apuntó la sesión o un admin puede borrarla");
    }

    if (gameId && night._count.games > 1) {
      await prisma.gameNightGame.deleteMany({ where: { nightId, gameId } });
      return NextResponse.json({ success: true, nightDeleted: false });
    }

    await prisma.gameNight.delete({ where: { id: nightId } });
    return NextResponse.json({ success: true, nightDeleted: true });
  }
);
