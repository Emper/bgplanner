import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireGroupMember, requireSession } from "@/lib/api";
import { inBackground } from "@/lib/background";
import { isGroupManager } from "@/lib/groupTypes";
import { deletePhotos, pathFromPublicUrl } from "@/lib/supabaseStorage";

// Borra una foto suelta de la galería. Solo el autor o un admin/owner del grupo.
export const DELETE = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; photoId: string }> }
  ) => {
    const session = await requireSession(request);
    const { id: groupId, photoId } = await params;

    const [membership, photo] = await Promise.all([
      requireGroupMember(groupId, session.userId),
      prisma.groupPhoto.findFirst({
        where: { id: photoId, groupId },
        select: { id: true, userId: true, url: true },
      }),
    ]);
    if (!photo) throw new ApiError(404, "Foto no encontrada");

    if (photo.userId !== session.userId && !isGroupManager(membership.role)) {
      throw new ApiError(403, "Solo quien la subió o un admin puede borrarla");
    }

    await prisma.groupPhoto.delete({ where: { id: photo.id } });

    const path = pathFromPublicUrl(photo.url);
    if (path) inBackground(() => deletePhotos([path]));

    return NextResponse.json({ ok: true });
  }
);
