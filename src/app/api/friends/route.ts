import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { friendAddSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { hasBlocked } from "@/lib/moderation";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { PUBLIC_USER_SELECT, displayName } from "@/lib/users";

/** Mis amigos, los últimos que he añadido primero. */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  const friendships = await prisma.friendship.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { friend: { select: PUBLIC_USER_SELECT } },
  });

  return NextResponse.json({
    userId: session.userId,
    friends: friendships.map((f) => f.friend),
  });
});

/** Añadir a alguien a mis amigos. Repetirlo no hace nada. */
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { userId: friendId } = await parseBody(request, friendAddSchema);

  if (friendId === session.userId) {
    throw new ApiError(400, "No puedes añadirte a ti mismo");
  }

  // Bloqueos: en ningún sentido hay amistad posible
  const [friend, blockedByThem, blockedByMe, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: friendId }, select: PUBLIC_USER_SELECT }),
    hasBlocked(friendId, session.userId),
    hasBlocked(session.userId, friendId),
    prisma.friendship.findUnique({
      where: { userId_friendId: { userId: session.userId, friendId } },
      select: { id: true },
    }),
  ]);
  if (!friend) throw new ApiError(404, "Ese jugador no existe");
  if (blockedByMe) {
    throw new ApiError(409, "Has bloqueado a este jugador. Desbloquéalo antes desde tu perfil");
  }
  if (blockedByThem) throw new ApiError(403, "No puedes añadir a este jugador");

  if (!existing) {
    // upsert y no create: dos clics seguidos no deben acabar en un 500
    await prisma.friendship.upsert({
      where: { userId_friendId: { userId: session.userId, friendId } },
      create: { userId: session.userId, friendId },
      update: {},
    });
    logActivity("friend_added", session.userId, {
      friendId,
      friendName: displayName(friend, "") || null,
    });
    notify({ type: "friend_added", userIds: [friendId], actorId: session.userId });
  }

  return NextResponse.json({ friend });
});

