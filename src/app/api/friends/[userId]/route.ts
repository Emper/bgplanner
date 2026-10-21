import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSession } from "@/lib/api";

type Params = { params: Promise<{ userId: string }> };

/** Quitar a alguien de mis amigos. Si no estaba, tampoco pasa nada. */
export const DELETE = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { userId: friendId } = await params;
  await prisma.friendship.deleteMany({
    where: { userId: session.userId, friendId },
  });
  return NextResponse.json({ ok: true });
});
