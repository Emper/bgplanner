import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { gameNightPlaySchema } from "@/lib/validations";
import { GAME_NIGHT_INCLUDE } from "@/lib/gameNights";
import { markGroupGamePlayed } from "@/lib/playedGames";

/** Una noche se puede seguir ampliando durante este rato desde que se abrió. */
const NIGHT_OPEN_MS = 12 * 60 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const [membership, nights] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.gameNight.findMany({
      where: { groupId },
      orderBy: { date: "desc" },
      include: GAME_NIGHT_INCLUDE,
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  return NextResponse.json(nights);
}

// "¡Lo jugamos!": apunta un juego en la noche (y la abre si es la primera
// partida) y lo marca como jugado en el grupo.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = gameNightPlaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { nightId, gameId } = parsed.data;
  const playerIds = Array.from(new Set(parsed.data.playerIds));

  const [groupGame, members, existing] = await Promise.all([
    prisma.groupGame.findUnique({
      where: { groupId_gameId: { groupId, gameId } },
      include: { game: { select: { name: true, thumbnail: true } } },
    }),
    prisma.groupMember.count({ where: { groupId, userId: { in: playerIds } } }),
    nightId
      ? prisma.gameNight.findFirst({ where: { id: nightId, groupId }, select: { id: true, createdAt: true } })
      : null,
  ]);

  if (!groupGame) {
    return NextResponse.json({ error: "Ese juego no está en el grupo" }, { status: 404 });
  }
  if (members !== playerIds.length) {
    return NextResponse.json({ error: "Solo pueden jugar miembros del grupo" }, { status: 400 });
  }
  if (nightId && !existing) {
    return NextResponse.json({ error: "Esa sesión ya no existe" }, { status: 404 });
  }

  const reuse = existing && Date.now() - existing.createdAt.getTime() < NIGHT_OPEN_MS;

  const night = reuse
    ? await prisma.gameNight.update({
        where: { id: existing.id },
        data: {
          // Quien se sume a media noche se añade; nadie se quita.
          players: {
            createMany: { data: playerIds.map((userId) => ({ userId })), skipDuplicates: true },
          },
          games: {
            connectOrCreate: {
              where: { nightId_gameId: { nightId: existing.id, gameId } },
              create: { gameId },
            },
          },
        },
        include: GAME_NIGHT_INCLUDE,
      })
    : await prisma.gameNight.create({
        data: {
          groupId,
          createdById: session.userId,
          players: { create: playerIds.map((userId) => ({ userId })) },
          games: { create: { gameId } },
        },
        include: GAME_NIGHT_INCLUDE,
      });

  await markGroupGamePlayed(groupId, groupGame, session.userId);

  logActivity("game_night_played", session.userId, {
    groupId,
    gameName: groupGame.game.name,
    players: playerIds.length,
  });

  return NextResponse.json(night, { status: 201 });
}
