import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEventParticipation } from "@/lib/events";
import { uploadPhoto, getStorageClient } from "@/lib/supabaseStorage";
import { logActivity } from "@/lib/activity";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_REQUEST = 10;

// Lista las fotos de la galería del evento.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id: eventId } = await params;

  const p = await getEventParticipation(eventId, session.userId);
  if (!p) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  if (!p.canView) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const photos = await prisma.eventPhoto.findMany({
    where: { eventId },
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

// Sube una o varias fotos a la galería (creador o asistente).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id: eventId } = await params;

  const p = await getEventParticipation(eventId, session.userId);
  if (!p) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  if (!p.canParticipate) {
    return NextResponse.json(
      { error: "Solo los asistentes pueden subir fotos" },
      { status: 403 }
    );
  }
  if (!getStorageClient()) {
    return NextResponse.json({ error: "La subida de fotos no está configurada" }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll("file") ?? []).filter(
    (f): f is File => f instanceof File
  );
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
      const { url } = await uploadPhoto(buffer, file.type, `events/${eventId}`);
      const photo = await prisma.eventPhoto.create({
        data: { eventId, userId: session.userId, url },
        include: {
          user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        },
      });
      created.push(photo);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Error desconocido al subir";
      console.error("[event photos] fallo al subir foto de evento:", e);
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: lastError || "No se pudo subir ninguna imagen" },
      { status: 400 }
    );
  }

  logActivity("event_photo_added", session.userId, {
    eventId,
    eventName: p.event.name,
    photoCount: created.length,
  });

  return NextResponse.json({ photos: created }, { status: 201 });
}
