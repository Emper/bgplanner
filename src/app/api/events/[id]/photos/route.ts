import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadPhoto, getStorageClient, deletePhotos } from "@/lib/supabaseStorage";
import { logActivity } from "@/lib/activity";
import { inBackground } from "@/lib/background";
import { ApiError, apiHandler, requireEventAccess, requireSession } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_REQUEST = 10;
// Lo mismo que acepta uploadPhoto: así el error se explica antes de subir
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Ctx = { params: Promise<{ id: string }> };

const PHOTO_USER = { select: { id: true, name: true, displayName: true, avatarUrl: true } };

// Las fotos de la galería del evento
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  await requireEventAccess(eventId, session.userId, "view");

  const photos = await prisma.eventPhoto.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: PHOTO_USER },
  });
  const response = NextResponse.json({ photos });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

// Sube una o varias fotos a la galería (creador o asistentes)
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  const p = await requireEventAccess(eventId, session.userId, "participate");
  if (!getStorageClient()) throw new ApiError(503, "La subida de fotos no está configurada");

  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new ApiError(400, "No se recibió ninguna imagen");
  if (files.length > MAX_PER_REQUEST) throw new ApiError(400, `Máximo ${MAX_PER_REQUEST} fotos a la vez`);

  const created = [];
  let lastError = "";
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      lastError = "Alguna imagen supera los 5 MB";
      continue;
    }
    if (!IMAGE_TYPES.has(file.type)) {
      lastError = "Formato de imagen no soportado: usa JPG, PNG o WebP";
      continue;
    }
    let uploadedPath: string | null = null;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { url, path } = await uploadPhoto(buffer, file.type, `events/${eventId}`);
      uploadedPath = path;
      const photo = await prisma.eventPhoto.create({
        data: { eventId, userId: session.userId, url },
        include: { user: PHOTO_USER },
      });
      created.push(photo);
    } catch (e) {
      // El detalle va a los logs; al usuario, un mensaje limpio
      console.error("[event photos] fallo al subir foto de evento:", e);
      lastError = "No se pudo subir alguna imagen";
      // Subida pero sin fila en la BD: que no se quede huérfana en el almacenamiento
      if (uploadedPath) {
        const path = uploadedPath;
        inBackground(() => deletePhotos([path]));
      }
    }
  }

  if (created.length === 0) throw new ApiError(400, lastError || "No se pudo subir ninguna imagen");

  logActivity("event_photo_added", session.userId, {
    eventId,
    eventName: p.event.name,
    photoCount: created.length,
  });

  return NextResponse.json({ photos: created }, { status: 201 });
});
