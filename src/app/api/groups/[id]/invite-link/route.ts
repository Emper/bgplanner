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

  const { id: groupId } = await params;

  const [membership, group] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.group.findUnique({
      where: { id: groupId },
      select: { inviteCode: true, inviteEnabled: true },
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  return NextResponse.json({
    inviteCode: group?.inviteCode,
    inviteEnabled: group?.inviteEnabled ?? true,
  });
}

// POST — generate a new invite code (or regenerate)
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

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Solo el admin puede gestionar el enlace" }, { status: 403 });
  }

  const inviteCode = crypto.randomBytes(16).toString("base64url");

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { inviteCode, inviteEnabled: true },
    select: { inviteCode: true, inviteEnabled: true },
  });

  return NextResponse.json(group);
}

// PATCH — enable/disable invite link
export async function PATCH(
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

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Solo el admin puede gestionar el enlace" }, { status: 403 });
  }

  const body = await request.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Campo 'enabled' requerido" }, { status: 400 });
  }

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { inviteEnabled: enabled },
    select: { inviteCode: true, inviteEnabled: true },
  });

  return NextResponse.json(group);
}
