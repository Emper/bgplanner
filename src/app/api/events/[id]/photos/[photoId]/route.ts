import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEventParticipation } from "@/lib/events";
import { deletePhotos, pathFromPublicUrl } from "@/lib/supabaseStorage";

// Borra una foto de la galería. Solo el autor o el gestor del evento.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id: eventId, photoId } = await params;

  const p = await getEventParticipation(eventId, session.userId);
  if (!p) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const photo = await prisma.eventPhoto.findFirst({
    where: { id: photoId, eventId },
    select: { id: true, userId: true, url: true },
  });
  if (!photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  if (photo.userId !== session.userId && !p.isCreator) {
    return NextResponse.json(
      { error: "Solo quien la subió o el gestor puede borrarla" },
      { status: 403 }
    );
  }

  await prisma.eventPhoto.delete({ where: { id: photo.id } });

  const path = pathFromPublicUrl(photo.url);
  if (path) deletePhotos([path]).catch(() => {});

  return NextResponse.json({ ok: true });
}
