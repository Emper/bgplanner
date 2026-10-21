import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSession } from "@/lib/api";

type Params = { params: Promise<{ userId: string }> };

/** Desbloquear. La amistad que se deshizo al bloquear no vuelve sola. */
export const DELETE = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { userId } = await params;
  await prisma.userBlock.deleteMany({ where: { blockerId: session.userId, blockedId: userId } });
  return NextResponse.json({ ok: true });
});
