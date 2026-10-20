import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Borra una noche entera o, con ?gameId=, solo uno de sus juegos (si era el
// último, se va la noche). Lo jugado sigue marcado: se devuelve a pendientes
// desde el ranking.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nightId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, nightId } = await params;
  const gameId = request.nextUrl.searchParams.get("gameId");

  const [membership, night] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.gameNight.findFirst({
      where: { id: nightId, groupId },
      select: { id: true, createdById: true, _count: { select: { games: true } } },
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }
  if (!night) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const isAdmin = membership.role === "admin" || membership.role === "owner";
  if (!isAdmin && night.createdById !== session.userId) {
    return NextResponse.json(
      { error: "Solo quien apuntó la sesión o un admin puede borrarla" },
      { status: 403 }
    );
  }

  if (gameId && night._count.games > 1) {
    await prisma.gameNightGame.deleteMany({ where: { nightId, gameId } });
    return NextResponse.json({ success: true, nightDeleted: false });
  }

  await prisma.gameNight.delete({ where: { id: nightId } });
  return NextResponse.json({ success: true, nightDeleted: true });
}
