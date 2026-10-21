import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, newToken, requireEventAccess, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

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
