import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { groupSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Run membership check and group data fetch in parallel
  const [membership, group] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: session.userId } },
    }),
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
                email: true,
                bggUsername: true,
              },
            },
          },
        },
        _count: { select: { games: true } },
        invitations: {
          where: { status: "pending" },
          select: { email: true, createdAt: true },
        },
      },
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const response = NextResponse.json({ ...group, currentUserRole: membership.role, currentUserId: session.userId });
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=10, stale-while-revalidate=60"
  );
  return response;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.userId } },
  });

  if (!membership || membership.role !== "admin" && membership.role !== "owner") {
    return NextResponse.json({ error: "Solo el admin puede editar" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = groupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const group = await prisma.group.update({
    where: { id },
    data: { name: parsed.data.name },
  });

  return NextResponse.json(group);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const [membership, group] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: session.userId } },
    }),
    prisma.group.findUnique({ where: { id }, select: { name: true } }),
  ]);

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Solo el propietario puede eliminar el grupo" }, { status: 403 });
  }

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  await prisma.group.delete({ where: { id } });

  // Activity log: groupId queda colgando porque el grupo ya no existe; lo
  // registramos sin groupId para que la entrada sobreviva al borrado en cascada.
  logActivity("group_deleted", session.userId, { groupName: group.name });

  return NextResponse.json({ success: true });
}
