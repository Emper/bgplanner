import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireGroupMember, requireSession } from "@/lib/api";
import { uploadPhoto, getStorageClient } from "@/lib/supabaseStorage";
import { logActivity } from "@/lib/activity";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_REQUEST = 10;

const PHOTO_USER_SELECT = { id: true, name: true, displayName: true, avatarUrl: true } as const;

type Ctx = { params: Promise<{ id: string }> };

// Fotos sueltas de la galería del grupo (no atadas a una opinión).
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  const [, photos] = await Promise.all([
    requireGroupMember(groupId, session.userId),
    prisma.groupPhoto.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: PHOTO_USER_SELECT } },
    }),
  ]);

  const response = NextResponse.json({ photos });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

// Sube una o varias fotos sueltas a la galería del grupo.
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  await requireGroupMember(groupId, session.userId);
  if (!getStorageClient()) {
    throw new ApiError(503, "La subida de fotos no está configurada");
  }

  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    throw new ApiError(400, "No se recibió ninguna imagen");
  }
  if (files.length > MAX_PER_REQUEST) {
    throw new ApiError(400, `Máximo ${MAX_PER_REQUEST} fotos a la vez`);
  }

  const created = [];
  // Si no sube ninguna, se explica con el último fallo, en palabras del usuario.
  let lastError = "";
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      lastError = "Alguna imagen supera los 5 MB";
      continue;
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadPhoto(buffer, file.type, `groups/${groupId}`);
      const photo = await prisma.groupPhoto.create({
        data: { groupId, userId: session.userId, url },
        include: { user: { select: PHOTO_USER_SELECT } },
      });
      created.push(photo);
    } catch (err) {
      console.error("[gallery-photos] fallo al subir foto de grupo:", err);
      lastError =
        err instanceof Error && err.message === "Formato de imagen no soportado"
          ? "Formato de imagen no soportado (usa JPG, PNG o WebP)"
          : "No se pudo subir la imagen";
    }
  }

  if (created.length === 0) {
    throw new ApiError(400, lastError || "No se pudo subir ninguna imagen");
  }

  logActivity("group_photo_added", session.userId, {
    groupId,
    photoCount: created.length,
  });

  return NextResponse.json({ photos: created }, { status: 201 });
});
