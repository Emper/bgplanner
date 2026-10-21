import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, parseBody, requireSession } from "@/lib/api";
import { groupSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { listMyGroups } from "@/lib/groupList";

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  return NextResponse.json(await listMyGroups(session.userId));
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
