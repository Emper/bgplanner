import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Solo el número, para el globo de la campana (se consulta a menudo). */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const unread = await prisma.notification.count({
    where: { userId: session.userId, readAt: null },
  });
  return NextResponse.json({ unread });
}
