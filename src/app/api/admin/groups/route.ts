import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const groups = await prisma.group.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true, email: true } },
      _count: { select: { members: true, games: true, sessions: true } },
    },
  });

  return NextResponse.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      createdAt: g.createdAt,
      owner: {
        id: g.createdBy.id,
        name: g.createdBy.displayName || g.createdBy.name || g.createdBy.email,
        email: g.createdBy.email,
      },
      members: g._count.members,
      games: g._count.games,
      sessions: g._count.sessions,
    }))
  );
}
