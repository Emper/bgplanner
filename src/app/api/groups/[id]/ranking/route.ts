import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { computeRanking } from "@/lib/ranking";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const [membership, memberCount] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.groupMember.count({ where: { groupId } }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const ranking = await computeRanking(groupId, session.userId);

  const response = NextResponse.json({ ranking, memberCount });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
