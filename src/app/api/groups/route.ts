import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, parseBody, requireSession } from "@/lib/api";
import { groupSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  // Se parte de las membresías de quien llama: así el «fijado» (que es suyo,
  // no del grupo) llega en la misma consulta.
  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.userId },
    select: {
      pinned: true,
      group: {
        include: {
          _count: { select: { members: true, games: { where: { archivedAt: null } } } },
          members: {
            include: { user: { select: { name: true, displayName: true, avatarUrl: true } } },
            take: 5,
          },
        },
      },
    },
    orderBy: { group: { createdAt: "desc" } },
  });

  // Los fijados primero; dentro de cada bloque, del más nuevo al más viejo.
  const result = memberships
    .map((m) => ({ ...m.group, pinned: m.pinned }))
    .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

  return NextResponse.json(result);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { name, type } = await parseBody(request, groupSchema);

  const group = await prisma.group.create({
    data: {
      name,
      type,
      createdById: session.userId,
      members: {
        create: {
          userId: session.userId,
          role: "owner",
        },
      },
    },
    include: {
      _count: { select: { members: true } },
    },
  });

  logActivity("group_created", session.userId, { groupId: group.id, groupName: name, groupType: type });

  return NextResponse.json(group, { status: 201 });
});
