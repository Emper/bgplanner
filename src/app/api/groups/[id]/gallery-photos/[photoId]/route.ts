import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deletePhotos, pathFromPublicUrl } from "@/lib/supabaseStorage";

// Borra una foto suelta de la galería. Solo el autor o un admin/owner del grupo.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id: groupId, photoId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const photo = await prisma.groupPhoto.findFirst({
    where: { id: photoId, groupId },
    select: { id: true, userId: true, url: true },
  });
  if (!photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  const isAdmin = membership.role === "admin" || membership.role === "owner";
  if (photo.userId !== session.userId && !isAdmin) {
    return NextResponse.json(
      { error: "Solo quien la subió o un admin puede borrarla" },
      { status: 403 }
    );
  }

  await prisma.groupPhoto.delete({ where: { id: photo.id } });

  const path = pathFromPublicUrl(photo.url);
  if (path) deletePhotos([path]).catch(() => {});

  return NextResponse.json({ ok: true });
}
