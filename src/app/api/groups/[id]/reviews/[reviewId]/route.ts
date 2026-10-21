import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireGroupMember, requireSession } from "@/lib/api";
import { inBackground } from "@/lib/background";
import { isGroupManager } from "@/lib/groupTypes";
import { deletePhotos, pathFromPublicUrl } from "@/lib/supabaseStorage";

// Borra una opinión. Solo el autor o un admin/owner del grupo pueden hacerlo.
export const DELETE = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; reviewId: string }> }
  ) => {
    const session = await requireSession(request);
    const { id: groupId, reviewId } = await params;

    const [membership, review] = await Promise.all([
      requireGroupMember(groupId, session.userId),
      prisma.gameReview.findFirst({
        where: { id: reviewId, groupGame: { groupId } },
        include: { photos: { select: { url: true } } },
      }),
    ]);
    if (!review) throw new ApiError(404, "Opinión no encontrada");

    if (review.userId !== session.userId && !isGroupManager(membership.role)) {
      throw new ApiError(403, "Solo el autor o un admin pueden borrar la opinión");
    }

    // Borrar la fila (cascade elimina las fotos en BD) y limpiar Storage.
    await prisma.gameReview.delete({ where: { id: review.id } });

    const paths = review.photos
      .map((p) => pathFromPublicUrl(p.url))
      .filter((p): p is string => !!p);
    if (paths.length > 0) inBackground(() => deletePhotos(paths));

    return NextResponse.json({ ok: true });
  }
);
