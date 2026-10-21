import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEventParticipation } from "@/lib/events";
import { decodeImageDataUrl } from "@/lib/storedImages";

// Sirve avatares y carteles de evento guardados en base64 (ver
// src/lib/storedImages.ts). La URL lleva una huella del contenido, así que
// se puede cachear para siempre. Los avatares son públicos como el perfil;
// el cartel de un evento privado solo lo ve quien puede ver el evento, y
// entonces la caché es solo del navegador.

type Ctx = { params: Promise<{ kind: string; id: string }> };

const notFound = () => new NextResponse(null, { status: 404 });

export async function GET(request: NextRequest, { params }: Ctx) {
  const { kind, id } = await params;

  let value: string | null | undefined;
  let isPublic = true;

  if (kind === "avatar") {
    const user = await prisma.user.findUnique({ where: { id }, select: { avatarUrl: true } });
    value = user?.avatarUrl;
  } else if (kind === "event") {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { imageUrl: true, visibility: true },
    });
    if (event && event.visibility !== "public") {
      const session = await getSession(request);
      const access = session ? await getEventParticipation(id, session.userId) : null;
      if (!access?.canView) return notFound();
      isPublic = false;
    }
    value = event?.imageUrl;
  } else {
    return notFound();
  }

  // Solo imágenes guardadas en base64: las que ya son una URL se enlazan
  // directamente (storedImageSrc no manda aquí) y redirigir a ellas sería
  // una redirección abierta a lo que alguien haya puesto de avatar.
  if (!value?.startsWith("data:")) return notFound();

  const image = decodeImageDataUrl(value);
  if (!image) return notFound();

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Content-Length": String(image.bytes.length),
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=31536000, immutable`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
