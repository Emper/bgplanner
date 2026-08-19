import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getBlockedUserIds } from "@/lib/moderation";
import { getEventParticipation } from "@/lib/events";
import { eventReviewSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// Lista las valoraciones del evento.
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

  // Las valoraciones de personas bloqueadas no se muestran.
  const blockedIds = await getBlockedUserIds(session.userId);

  const reviews = await prisma.eventReview.findMany({
    where: {
      eventId,
      ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
    },
  });
  const response = NextResponse.json({ reviews });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Crea o actualiza la valoración propia del evento (una por usuario).
export async function PUT(
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
      { error: "Solo los asistentes pueden valorar el evento" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = eventReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const rating = parsed.data.rating ?? null;
  const text = parsed.data.text?.trim() || null;

  const existing = await prisma.eventReview.findUnique({
    where: { eventId_userId: { eventId, userId: session.userId } },
    select: { id: true },
  });

  // Vacía por completo → borrar la valoración.
  if (rating === null && !text) {
    if (existing) await prisma.eventReview.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, review: null });
  }

  const review = await prisma.eventReview.upsert({
    where: { eventId_userId: { eventId, userId: session.userId } },
    create: { eventId, userId: session.userId, rating, text },
    update: { rating, text },
    include: {
      user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!existing) {
    logActivity("event_reviewed", session.userId, {
      eventId,
      eventName: p.event.name,
      rating: rating ?? undefined,
    });
  }

  return NextResponse.json({ ok: true, review });
}
