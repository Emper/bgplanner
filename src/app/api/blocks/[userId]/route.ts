import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Desbloquear a una persona.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId } = await params;

  const { count } = await prisma.block.deleteMany({
    where: { blockerId: session.userId, blockedId: userId },
  });

  if (count === 0) {
    return NextResponse.json(
      { error: "No tenías bloqueada a esa persona" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
