import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyManagers } from "@/lib/notifications";
import { ApiError, apiHandler, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ code: string }> };

/** El grupo de un enlace de invitación activo, o 404. */
async function findGroupByCode(code: string) {
  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, inviteEnabled: true, _count: { select: { members: true } } },
  });
  if (!group || !group.inviteEnabled) {
    throw new ApiError(404, "Enlace de invitación no válido o desactivado");
  }
  return group;
}

// Qué grupo hay detrás del enlace (sin sesión también) y, con sesión, si ya
// eres miembro
export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const { code } = await params;

  const [session, group] = await Promise.all([getSession(request), findGroupByCode(code)]);

  const membership = session
    ? await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: session.userId } },
        select: { id: true },
      })
    : null;

  return NextResponse.json({
    groupId: group.id,
    groupName: group.name,
    memberCount: group._count.members,
    alreadyMember: !!membership,
  });
});

// Unirse al grupo con el enlace
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { code } = await params;

  const group = await findGroupByCode(code);

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: session.userId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ alreadyMember: true, groupId: group.id, groupName: group.name });
  }

  await prisma.groupMember.create({
    data: { groupId: group.id, userId: session.userId, role: "member" },
  });

  logActivity("group_joined", session.userId, { groupId: group.id, groupName: group.name });
  notifyManagers({ groupId: group.id }, { type: "group_member_joined", actorId: session.userId });

  return NextResponse.json({ joined: true, groupId: group.id, groupName: group.name });
});
