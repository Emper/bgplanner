import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

// Enlace de solo lectura a tu lista de un evento, para pasársela a quien te
// acompañe. Mismo planteamiento que el de la colección: el token no se puede
// adivinar, lo abre cualquiera que lo tenga y regenerarlo tumba el anterior.

async function findAttendee(request: NextRequest, eventId: string) {
  const session = await getSession(request);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };

  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId: session.userId } },
    select: { id: true, listShareToken: true },
  });
  if (!attendee) {
    return { error: NextResponse.json({ error: "Debes estar apuntado al evento" }, { status: 403 }) };
  }
  return { attendee };
}

// GET — enlace actual (null si no está compartida)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { attendee, error } = await findAttendee(request, id);
  if (error) return error;

  return NextResponse.json({ token: attendee.listShareToken });
}

// POST — crear el enlace, o regenerarlo si ya existía
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { attendee, error } = await findAttendee(request, id);
  if (error) return error;

  const updated = await prisma.eventAttendee.update({
    where: { id: attendee.id },
    data: { listShareToken: crypto.randomBytes(16).toString("base64url") },
    select: { listShareToken: true },
  });

  return NextResponse.json({ token: updated.listShareToken });
}

// DELETE — dejar de compartir
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { attendee, error } = await findAttendee(request, id);
  if (error) return error;

  await prisma.eventAttendee.update({
    where: { id: attendee.id },
    data: { listShareToken: null },
  });

  return NextResponse.json({ token: null });
}
