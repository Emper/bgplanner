import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uploadPhoto, getStorageClient } from "@/lib/supabaseStorage";
import { logActivity } from "@/lib/activity";

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

  const photos = await prisma.groupPhoto.findMany({
    where: { groupId },
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
  for (const file of files) {
    if (file.size > MAX_BYTES) continue;
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
    } catch {
      // Ignorar la que falle; devolvemos las que sí se subieron.
    }
  }

  if (created.length === 0) {
    return NextResponse.json({ error: "No se pudo subir ninguna imagen" }, { status: 400 });
  }

  logActivity("group_photo_added", session.userId, {
    groupId,
    photoCount: created.length,
  });

  return NextResponse.json({ photos: created }, { status: 201 });
}
