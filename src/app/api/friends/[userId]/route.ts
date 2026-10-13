import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Quitar a alguien de mis amigos. Si no estaba, tampoco pasa nada. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId: friendId } = await params;
  await prisma.friendship.deleteMany({
    where: { userId: session.userId, friendId },
  });

  return NextResponse.json({ ok: true });
}
