import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventReviewSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { apiHandler, parseBody, requireEventAccess, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const REVIEW_USER = { select: { id: true, name: true, displayName: true, avatarUrl: true } };

// Las valoraciones del evento
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  await requireEventAccess(eventId, session.userId, "view");

  const reviews = await prisma.eventReview.findMany({
    where: { eventId },
    orderBy: { updatedAt: "desc" },
    include: { user: REVIEW_USER },
  });
  const response = NextResponse.json({ reviews });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

// Crea o actualiza la valoración propia del evento (una por usuario)
export const PUT = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  const p = await requireEventAccess(eventId, session.userId, "participate");

  const body = await parseBody(request, eventReviewSchema);
  const rating = body.rating ?? null;
  const text = body.text?.trim() || null;

  const existing = await prisma.eventReview.findUnique({
    where: { eventId_userId: { eventId, userId: session.userId } },
    select: { id: true },
  });

  // Vacía por completo → borrar la valoración
  if (rating === null && !text) {
    if (existing) await prisma.eventReview.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, review: null });
  }

  const review = await prisma.eventReview.upsert({
    where: { eventId_userId: { eventId, userId: session.userId } },
    create: { eventId, userId: session.userId, rating, text },
    update: { rating, text },
    include: { user: REVIEW_USER },
  });

  if (!existing) {
    logActivity("event_reviewed", session.userId, {
      eventId,
      eventName: p.event.name,
      rating: rating ?? undefined,
    });
  }

  return NextResponse.json({ ok: true, review });
});
