import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEventParticipation } from "@/lib/events";
import { decodeImageDataUrl } from "@/lib/storedImages";
import { readStoredImage } from "@/lib/storedImageData";

// Sirve avatares y carteles de evento guardados en base64 (ver
// src/lib/storedImages.ts). La URL lleva una huella del contenido, así que
// se puede cachear para siempre. Los avatares son públicos como el perfil;
// el cartel de un evento privado solo lo ve quien puede ver el evento, y
// entonces la caché es solo del navegador.

type Ctx = { params: Promise<{ kind: string; id: string }> };

const notFound = () => new NextResponse(null, { status: 404 });

export async function GET(request: NextRequest, { params }: Ctx) {
  const { kind, id } = await params;

  if (kind !== "avatar" && kind !== "event") return notFound();
  const { value, visibility } = await readStoredImage(kind, id);
  let isPublic = true;

  if (visibility !== "public") {
    const session = await getSession(request);
    const access = session ? await getEventParticipation(id, session.userId) : null;
    if (!access?.canView) return notFound();
    isPublic = false;
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
