import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSession } from "@/lib/api";

/** Solo el número, para el globo de la campana (se consulta a menudo). */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const unread = await prisma.notification.count({
    where: { userId: session.userId, readAt: null },
  });
  return NextResponse.json({ unread });
});
