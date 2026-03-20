import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET — public: resolve invite code to group info
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      inviteEnabled: true,
      _count: { select: { members: true } },
    },
  });

  if (!group || !group.inviteEnabled) {
    return NextResponse.json(
      { error: "Enlace de invitación no válido o desactivado" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    groupId: group.id,
    groupName: group.name,
    memberCount: group._count.members,
  });
}

// POST — auth required: join the group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, inviteEnabled: true },
  });

  if (!group || !group.inviteEnabled) {
    return NextResponse.json(
      { error: "Enlace de invitación no válido o desactivado" },
      { status: 404 }
    );
  }

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: session.userId } },
  });

  if (existing) {
    return NextResponse.json({
      alreadyMember: true,
      groupId: group.id,
      groupName: group.name,
    });
  }

  // Join the group
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: session.userId,
      role: "member",
    },
  });

  return NextResponse.json({
    joined: true,
    groupId: group.id,
    groupName: group.name,
  });
}
