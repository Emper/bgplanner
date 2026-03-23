import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET — resolve token to invitation info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invitation = await prisma.groupInvitation.findUnique({
    where: { token },
    include: {
      group: { select: { id: true, name: true, _count: { select: { members: true } } } },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitación no válida" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ error: "Esta invitación ya fue utilizada" }, { status: 410 });
  }

  return NextResponse.json({
    groupId: invitation.group.id,
    groupName: invitation.group.name,
    memberCount: invitation.group._count.members,
    email: invitation.email,
  });
}

// POST — accept invitation and join group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { token } = await params;

  const invitation = await prisma.groupInvitation.findUnique({
    where: { token },
    include: { group: { select: { id: true, name: true } } },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitación no válida" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ error: "Esta invitación ya fue utilizada" }, { status: 410 });
  }

  const groupId = invitation.groupId;

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (existing) {
    await prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
    return NextResponse.json({ groupId, groupName: invitation.group.name, alreadyMember: true });
  }

  await prisma.$transaction([
    prisma.groupMember.create({
      data: { groupId, userId: session.userId, role: "member" },
    }),
    prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    }),
  ]);

  return NextResponse.json({ groupId, groupName: invitation.group.name });
}
