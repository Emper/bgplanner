import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Desbloquear. La amistad que se deshizo al bloquear no vuelve sola. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId } = await params;
  await prisma.userBlock.deleteMany({ where: { blockerId: session.userId, blockedId: userId } });
  return NextResponse.json({ ok: true });
}
