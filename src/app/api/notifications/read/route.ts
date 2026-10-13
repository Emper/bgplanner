import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notificationsReadSchema } from "@/lib/validations";

/** Marca como leídas las indicadas, o todas si no se indica ninguna. */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = notificationsReadSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { ids } = parsed.data;

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
}
