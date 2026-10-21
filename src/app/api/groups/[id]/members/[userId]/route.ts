import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { displayName } from "@/lib/users";
import { memberRoleSchema } from "@/lib/validations";

// Cambia el rol de un miembro (admin ↔ miembro). El propietario no se toca.
export const PATCH = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
  ) => {
    const session = await requireSession(request);
    const { id: groupId, userId: targetUserId } = await params;
    const { role } = await parseBody(request, memberRoleSchema);

    if (targetUserId === session.userId) {
      throw new ApiError(400, "No puedes cambiar tu propio rol");
    }

    const [requester, target] = await Promise.all([
      requireGroupMember(groupId, session.userId, { manager: true }),
      prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        include: { user: { select: { name: true, displayName: true } } },
      }),
    ]);

    if (!target) {
      throw new ApiError(404, "Esa persona no es miembro del grupo");
    }
    if (target.role === "owner") {
      throw new ApiError(403, "No se puede modificar el rol del propietario del grupo");
    }
    // Quitar el rol de admin, solo el propietario
    if (target.role === "admin" && role === "member" && requester.role !== "owner") {
      throw new ApiError(403, "Solo el propietario puede quitar el rol de admin");
    }

    if (target.role === role) {
      return NextResponse.json({ success: true, role });
    }

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

    logActivity(role === "admin" ? "member_promoted" : "member_demoted", session.userId, {
      groupId,
      targetName: displayName(target.user),
    });

    return NextResponse.json({ success: true, role });
  }
);
