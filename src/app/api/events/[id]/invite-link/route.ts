import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, newToken, requireEventAccess, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// El código de invitación actual (creador o admins)
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  const [, event] = await Promise.all([
    requireEventAccess(eventId, session.userId, "manage"),
    prisma.event.findUnique({ where: { id: eventId }, select: { inviteCode: true } }),
  ]);

  return NextResponse.json({ inviteCode: event?.inviteCode ?? null });
});

// Genera un código nuevo: el anterior deja de valer (creador o admins)
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: eventId } = await params;

  await requireEventAccess(eventId, session.userId, "manage");

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { inviteCode: newToken() },
    select: { inviteCode: true },
  });

  return NextResponse.json(updated);
});
