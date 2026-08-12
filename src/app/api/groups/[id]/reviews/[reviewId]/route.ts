import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deletePhotos, pathFromPublicUrl } from "@/lib/supabaseStorage";

// Borra una opinión. Solo el autor o un admin/owner del grupo pueden hacerlo.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, reviewId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const review = await prisma.gameReview.findFirst({
    where: { id: reviewId, groupGame: { groupId } },
    include: { photos: { select: { url: true } } },
  });
  if (!review) {
    return NextResponse.json({ error: "Opinión no encontrada" }, { status: 404 });
  }

  const isAdmin = membership.role === "admin" || membership.role === "owner";
  if (review.userId !== session.userId && !isAdmin) {
    return NextResponse.json(
      { error: "Solo el autor o un admin pueden borrar la opinión" },
      { status: 403 }
    );
  }

  // Borrar la fila (cascade elimina las fotos en BD) y limpiar Storage.
  await prisma.gameReview.delete({ where: { id: review.id } });

  const paths = review.photos
    .map((p) => pathFromPublicUrl(p.url))
    .filter((p): p is string => !!p);
  deletePhotos(paths).catch(() => {});

  return NextResponse.json({ ok: true });
}
