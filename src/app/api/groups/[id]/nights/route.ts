import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { gameNightPlaySchema } from "@/lib/validations";
import { GAME_NIGHT_INCLUDE } from "@/lib/gameNights";
import { markGroupGamePlayed } from "@/lib/playedGames";

/** Una noche se puede seguir ampliando durante este rato desde que se abrió. */
const NIGHT_OPEN_MS = 12 * 60 * 60 * 1000;

type Ctx = { params: Promise<{ id: string }> };

// "¡Lo jugamos!": apunta un juego en la noche (y la abre si es la primera
// partida) y lo marca como jugado en el grupo.
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  await requireGroupMember(groupId, session.userId);
  const parsed = await parseBody(request, gameNightPlaySchema);
  const { nightId, gameId } = parsed;
  const playerIds = Array.from(new Set(parsed.playerIds));

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

  if (!groupGame) throw new ApiError(404, "Ese juego no está en el grupo");
  if (members !== playerIds.length) {
    throw new ApiError(400, "Solo pueden jugar miembros del grupo");
  }
  if (nightId && !existing) throw new ApiError(404, "Esa sesión ya no existe");

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
});
