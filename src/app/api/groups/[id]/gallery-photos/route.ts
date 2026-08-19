import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getBlockedUserIds } from "@/lib/moderation";
import { uploadPhoto, getStorageClient } from "@/lib/supabaseStorage";
import { logActivity } from "@/lib/activity";
import { notifyGroupPhotosAdded } from "@/lib/notificationEmitters";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_REQUEST = 10;

// Fotos sueltas de la galería del grupo (no atadas a una opinión).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  // Las fotos de personas bloqueadas no se muestran.
  const blockedIds = await getBlockedUserIds(session.userId);

  const photos = await prisma.groupPhoto.findMany({
    where: {
      groupId,
      ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
    },
  });
  const response = NextResponse.json({ photos });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Sube una o varias fotos sueltas a la galería del grupo.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }
  if (!getStorageClient()) {
    return NextResponse.json({ error: "La subida de fotos no está configurada" }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
  }
  if (files.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Máximo ${MAX_PER_REQUEST} fotos a la vez` }, { status: 400 });
  }

  const created = [];
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
        include: {
          user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        },
      });
      created.push(photo);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Error desconocido al subir";
      console.error("[gallery-photos] fallo al subir foto de grupo:", e);
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: lastError || "No se pudo subir ninguna imagen" },
      { status: 400 }
    );
  }

  logActivity("group_photo_added", session.userId, {
    groupId,
    photoCount: created.length,
  });

  after(() =>
    notifyGroupPhotosAdded({
      groupId,
      actorUserId: session.userId,
      photoCount: created.length,
    })
  );

  return NextResponse.json({ photos: created }, { status: 201 });
}
