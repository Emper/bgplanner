import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { blockSchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { PUBLIC_USER_SELECT } from "@/lib/users";

/** A quién he bloqueado, los últimos primero. */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  const rows = await prisma.userBlock.findMany({
    where: { blockerId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, blocked: { select: PUBLIC_USER_SELECT } },
  });

  return NextResponse.json({
    blocked: rows.map((r) => ({ ...r.blocked, blockedAt: r.createdAt })),
  });
});

/**
 * Bloquear a alguien. Deja de salirte en la Comunidad y de mandarte avisos,
 * y no puede añadirte a amigos; la amistad que hubiera, en cualquier sentido,
 * se deshace. Repetirlo no hace nada.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { userId: blockedId } = await parseBody(request, blockSchema);

  if (blockedId === session.userId) {
    throw new ApiError(400, "No puedes bloquearte a ti mismo");
  }

  const [target, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } }),
    prisma.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: session.userId, blockedId } },
      select: { id: true },
    }),
  ]);
  if (!target) throw new ApiError(404, "Ese jugador no existe");

  if (!existing) {
    await prisma.$transaction([
      // upsert y no create: dos clics seguidos no deben acabar en un 500
      prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: session.userId, blockedId } },
        create: { blockerId: session.userId, blockedId },
        update: {},
      }),
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId: session.userId, friendId: blockedId },
            { userId: blockedId, friendId: session.userId },
          ],
        },
      }),
      // Lo que ya te hubiera llegado suyo y no has leído, fuera de la campana
      prisma.notification.deleteMany({
        where: { userId: session.userId, actorId: blockedId, readAt: null },
      }),
    ]);
    logActivity("user_blocked", session.userId);
  }

  return NextResponse.json({ ok: true });
});
