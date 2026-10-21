import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { displayName } from "@/lib/users";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, userId: targetUserId } = await params;
  const body = await request.json();
  const { role } = body;

  if (!role || !["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Check requester is admin or owner
  const requesterMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  const requesterIsAdminOrOwner = requesterMembership?.role === "admin" || requesterMembership?.role === "owner";
  if (!requesterMembership || !requesterIsAdminOrOwner) {
    return NextResponse.json({ error: "Solo admins y propietarios pueden cambiar roles" }, { status: 403 });
  }

  // Can't change your own role
  if (targetUserId === session.userId) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 });
  }

  // Check target is a member
  const targetMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    include: { user: { select: { name: true, displayName: true } } },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Usuario no es miembro del grupo" }, { status: 404 });
  }

  // Nobody can change the owner's role
  if (targetMembership.role === "owner") {
    return NextResponse.json({ error: "No se puede modificar el rol del propietario del grupo" }, { status: 403 });
  }

  // Only owner can demote admins
  if (targetMembership.role === "admin" && role === "member" && requesterMembership.role !== "owner") {
    return NextResponse.json({ error: "Solo el propietario puede quitar el rol de admin" }, { status: 403 });
  }

  // Don't update if already the same role
  if (targetMembership.role === role) {
    return NextResponse.json({ success: true, role });
  }

  // Update role
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    data: { role },
  });

  notify({
    type: "group_role_changed",
    userIds: [targetUserId],
    actorId: session.userId,
    groupId,
    metadata: { role },
  });

  logActivity(role === "admin" ? "member_promoted" : "member_demoted", session.userId, { groupId, targetName: displayName(targetMembership.user) });

  return NextResponse.json({ success: true, role });
}
