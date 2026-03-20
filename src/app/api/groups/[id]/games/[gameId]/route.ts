import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, gameId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const groupGame = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId } },
  });

  if (!groupGame) {
    return NextResponse.json(
      { error: "Juego no encontrado en este grupo" },
      { status: 404 }
    );
  }

  // Only the user who added the game or a group admin can delete it
  const isAdmin = membership.role === "admin";
  const isOwner = groupGame.addedById === session.userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Solo quien añadió el juego o el admin puede eliminarlo" },
      { status: 403 }
    );
  }

  // Deleting GroupGame cascades to votes (onDelete: Cascade on Vote)
  await prisma.groupGame.delete({
    where: { id: groupGame.id },
  });

  return NextResponse.json({ success: true });
}
