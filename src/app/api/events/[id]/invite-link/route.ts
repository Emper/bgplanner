import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

// GET — return current invite link info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { inviteCode: true, createdById: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ inviteCode: event.inviteCode });
}

// POST — generate a new invite code (creator only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.createdById !== session.userId) {
    return NextResponse.json({ error: "Solo el gestor puede gestionar el enlace" }, { status: 403 });
  }

  const inviteCode = crypto.randomBytes(16).toString("base64url");

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { inviteCode },
    select: { inviteCode: true },
  });

  return NextResponse.json(updated);
}
