import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notificationsReadSchema } from "@/lib/validations";
import { apiHandler, parseBody, requireSession } from "@/lib/api";

/** Marca como leídas las indicadas, o todas si no se indica ninguna. */
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { ids } = await parseBody(request, notificationsReadSchema);

  await prisma.notification.updateMany({
    where: {
      userId: session.userId,
      readAt: null,
      ...(ids ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });

  const unread = await prisma.notification.count({
    where: { userId: session.userId, readAt: null },
  });
  return NextResponse.json({ unread });
});
