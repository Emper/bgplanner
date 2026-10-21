import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSuperadmin } from "@/lib/api";
import { displayName } from "@/lib/users";

export const GET = apiHandler(async (request: NextRequest) => {
  await requireSuperadmin(request);

  const groups = await prisma.group.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true, email: true } },
      _count: { select: { members: true, games: true, nights: true } },
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
        name: displayName(g.createdBy, g.createdBy.email),
        email: g.createdBy.email,
      },
      members: g._count.members,
      games: g._count.games,
      nights: g._count.nights,
    }))
  );
});
