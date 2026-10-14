import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { blockSchema } from "@/lib/validations";

// Lo justo para pintar la lista de bloqueados: nada de email.
const BLOCKED_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  slug: true,
} as const;

/** A quién he bloqueado, los últimos primero. */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.userBlock.findMany({
    where: { blockerId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, blocked: { select: BLOCKED_SELECT } },
  });

  return NextResponse.json({
    blocked: rows.map((r) => ({ ...r.blocked, blockedAt: r.createdAt })),
  });
}

/**
 * Bloquear a alguien. Deja de salirte en la Comunidad y de mandarte avisos,
 * y no puede añadirte a amigos; la amistad que hubiera, en cualquier sentido,
 * se deshace. Repetirlo no hace nada.
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { userId: blockedId } = parsed.data;

  if (blockedId === session.userId) {
    return NextResponse.json({ error: "No puedes bloquearte a ti mismo" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Ese jugador no existe" }, { status: 404 });
  }

  const existing = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: session.userId, blockedId } },
    select: { id: true },
  });
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
}
