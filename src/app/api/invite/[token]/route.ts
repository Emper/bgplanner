import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyManagers } from "@/lib/notifications";
import { ApiError, apiHandler, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ token: string }> };

/** Una invitación por email aún sin usar, o 404/410. */
async function findPendingInvitation(token: string) {
  const invitation = await prisma.groupInvitation.findUnique({
    where: { token },
    include: {
      group: { select: { id: true, name: true, _count: { select: { members: true } } } },
    },
  });
  if (!invitation) throw new ApiError(404, "Invitación no válida");
  if (invitation.status !== "pending") throw new ApiError(410, "Esta invitación ya fue utilizada");
  return invitation;
}

// Qué grupo hay detrás de la invitación (sin sesión también)
export const GET = apiHandler(async (_request: NextRequest, { params }: Ctx) => {
  const { token } = await params;
  const invitation = await findPendingInvitation(token);

  return NextResponse.json({
    groupId: invitation.group.id,
    groupName: invitation.group.name,
    memberCount: invitation.group._count.members,
    // Sin el email invitado: el enlace se puede reenviar y es un dato privado.
  });
});

// Aceptar la invitación y entrar en el grupo. Vale con cualquier cuenta,
// aunque no sea la del email invitado: el enlace se puede reenviar.
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { token } = await params;

  const invitation = await findPendingInvitation(token);
  const { id: groupId, name: groupName } = invitation.group;

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
    return NextResponse.json({ groupId, groupName, alreadyMember: true });
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

  logActivity("group_joined", session.userId, { groupId, groupName });
  notifyManagers({ groupId }, { type: "group_member_joined", actorId: session.userId });

  return NextResponse.json({ groupId, groupName });
});
