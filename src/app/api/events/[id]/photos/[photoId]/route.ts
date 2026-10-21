import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletePhotos, pathFromPublicUrl } from "@/lib/supabaseStorage";
import { inBackground } from "@/lib/background";
import { ApiError, apiHandler, requireEventAccess, requireSession } from "@/lib/api";

// Borra una foto de la galería. Solo el autor o quien gestiona el evento.
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) => {
    const session = await requireSession(request);
    const { id: eventId, photoId } = await params;

    const [p, photo] = await Promise.all([
      requireEventAccess(eventId, session.userId, "view"),
      prisma.eventPhoto.findFirst({
        where: { id: photoId, eventId },
        select: { id: true, userId: true, url: true },
      }),
    ]);

    if (!photo) throw new ApiError(404, "Foto no encontrada");
    if (photo.userId !== session.userId && !p.isAdmin) {
      throw new ApiError(403, "Solo quien la subió o quien gestiona el evento puede borrarla");
    }

    await prisma.eventPhoto.delete({ where: { id: photo.id } });

    const path = pathFromPublicUrl(photo.url);
    if (path) inBackground(() => deletePhotos([path]));

    return NextResponse.json({ ok: true });
  }
);
