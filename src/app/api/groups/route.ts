import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { groupSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId: session.userId } },
    },
    include: {
      _count: { select: { members: true, games: true } },
      members: {
        include: { user: { select: { name: true, avatarUrl: true } } },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = groupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
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

  logActivity("group_created", session.userId, { groupId: group.id, groupName: parsed.data.name });

  return NextResponse.json(group, { status: 201 });
}
