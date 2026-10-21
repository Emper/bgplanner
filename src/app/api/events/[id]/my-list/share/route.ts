import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, newToken, requireEventAccess, requireSession } from "@/lib/api";

// Enlace de solo lectura a tu lista de un evento, para pasársela a quien te
// acompañe. El token no se puede adivinar, lo abre cualquiera que lo tenga
// y regenerarlo invalida el anterior.

type Ctx = { params: Promise<{ id: string }> };

/** La ficha de asistente de quien llama: el enlace cuelga de ella. */
async function requireAttendee(request: NextRequest, eventId: string) {
  const session = await requireSession(request);
  const [, attendee] = await Promise.all([
    requireEventAccess(eventId, session.userId, "participate"),
    prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId: session.userId } },
      select: { id: true, listShareToken: true },
    }),
  ]);
  if (!attendee) throw new ApiError(403, "Debes estar apuntado al evento");
  return attendee;
}

// El enlace actual (null si no está compartida)
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const attendee = await requireAttendee(request, id);

  return NextResponse.json({ token: attendee.listShareToken });
});

// Crear el enlace, o regenerarlo si ya existía
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const attendee = await requireAttendee(request, id);

  const updated = await prisma.eventAttendee.update({
    where: { id: attendee.id },
    data: { listShareToken: newToken() },
    select: { listShareToken: true },
  });

  return NextResponse.json({ token: updated.listShareToken });
});

// Dejar de compartir
export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const attendee = await requireAttendee(request, id);

  await prisma.eventAttendee.update({
    where: { id: attendee.id },
    data: { listShareToken: null },
  });

  return NextResponse.json({ token: null });
});
