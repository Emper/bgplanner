import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { friendAddSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

// Solo lo que hace falta para pintar el acceso a su perfil: nada de email.
const FRIEND_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  slug: true,
} as const;

/** Mis amigos, los últimos que he añadido primero. */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const friendships = await prisma.friendship.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { friend: { select: FRIEND_SELECT } },
  });

  return NextResponse.json({
    userId: session.userId,
    friends: friendships.map((f) => f.friend),
  });
}

/** Añadir a alguien a mis amigos. Repetirlo no hace nada. */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = friendAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { userId: friendId } = parsed.data;

  if (friendId === session.userId) {
    return NextResponse.json({ error: "No puedes añadirte a ti mismo" }, { status: 400 });
  }

  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: FRIEND_SELECT,
  });
  if (!friend) {
    return NextResponse.json({ error: "Ese jugador no existe" }, { status: 404 });
  }

  const existing = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: session.userId, friendId } },
    select: { id: true },
  });
  if (!existing) {
    // upsert y no create: dos clics seguidos no deben acabar en un 500
    await prisma.friendship.upsert({
      where: { userId_friendId: { userId: session.userId, friendId } },
      create: { userId: session.userId, friendId },
      update: {},
    });
    logActivity("friend_added", session.userId, {
      friendId,
      friendName: friend.displayName || friend.name || null,
    });
    notify({ type: "friend_added", userIds: [friendId], actorId: session.userId });
  }

  return NextResponse.json({ friend });
}
