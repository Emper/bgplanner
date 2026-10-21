import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperadmin } from "@/lib/auth";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { isGroupManager } from "@/lib/groupTypes";
import { groupSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id } = await params;

  // Membresía y datos del grupo a la vez
  const [membership, group] = await Promise.all([
    requireGroupMember(id, session.userId),
    prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                displayName: true,
                avatarUrl: true,
                bggUsername: true,
                slug: true,
              },
            },
          },
        },
        _count: { select: { games: { where: { archivedAt: null } } } },
        invitations: {
          where: { status: "pending" },
          select: { email: true, createdAt: true },
        },
      },
    }),
  ]);

  const response = NextResponse.json({
    ...group,
    // Los emails invitados solo los ve quien gestiona las invitaciones.
    invitations: isGroupManager(membership.role) ? group?.invitations ?? [] : [],
    currentUserRole: membership.role,
    currentUserId: session.userId,
  });
  // Personal (rol, invitaciones): que ninguna caché compartida la guarde.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});

export const PUT = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id } = await params;

  // El superadmin puede renombrar cualquier grupo; los demás, si lo gestionan.
  if (!(await isSuperadmin(session))) {
    await requireGroupMember(id, session.userId, { manager: true });
  }

  const { name } = await parseBody(request, groupSchema);

  const exists = await prisma.group.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new ApiError(404, "Grupo no encontrado");

  const group = await prisma.group.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json(group);
});

export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id } = await params;

  const admin = await isSuperadmin(session);
  const [membership, group] = await Promise.all([
    admin ? null : requireGroupMember(id, session.userId),
    prisma.group.findUnique({ where: { id }, select: { name: true } }),
  ]);

  if (membership && membership.role !== "owner") {
    throw new ApiError(403, "Solo el propietario puede eliminar el grupo");
  }
  if (!group) throw new ApiError(404, "Grupo no encontrado");

  await prisma.group.delete({ where: { id } });

  // Activity log: groupId queda colgando porque el grupo ya no existe; lo
  // registramos sin groupId para que la entrada sobreviva al borrado en cascada.
  logActivity("group_deleted", session.userId, {
    groupName: group.name,
    ...(admin ? { actorRole: "superadmin" } : {}),
  });

  return NextResponse.json({ success: true });
});
