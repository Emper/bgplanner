import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { getGroupType } from "@/lib/groupTypes";

interface PlayedGroupGame {
  id: string;
  playedAt: Date | null;
  game: { name: string; thumbnail: string | null };
}

/**
 * Marca un juego del grupo como jugado ahora. Lo usan "Marcar jugado" del
 * ranking y la noche de juego, para que los dos caminos hagan lo mismo.
 */
export async function markGroupGamePlayed(groupId: string, groupGame: PlayedGroupGame, actorId: string) {
  await prisma.groupGame.update({
    where: { id: groupGame.id },
    data: { playedAt: new Date() },
  });

  // Libera los votos con hueco limitado por el tipo de grupo (p. ej. el super
  // voto en "friends"). Los modos sin límites conservan sus votos: nadie está
  // "esperando" su hueco.
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { type: true },
  });
  const limitedValues = getGroupType(group?.type)
    .voteLimits.filter((l) => l.max <= 1)
    .map((l) => l.value);

  const superVotes = limitedValues.length
    ? await prisma.vote.findMany({
        where: { groupGameId: groupGame.id, value: { in: limitedValues } },
        select: { userId: true },
      })
    : [];

  if (superVotes.length > 0) {
    await prisma.vote.updateMany({
      where: { groupGameId: groupGame.id, value: { in: limitedValues } },
      data: { value: 1 },
    });

    notify({
      type: "super_vote_freed",
      userIds: superVotes.map((v) => v.userId),
      actorId,
      groupId,
      metadata: { gameName: groupGame.game.name, thumbnail: groupGame.game.thumbnail ?? null },
    });
  }

  // Solo en la transición pendiente → jugado (evita re-disparar al re-marcar).
  // La invitación a opinar NO se manda aquí: la deja el cron diario en la
  // campana ("valora los juegos de ayer"), uno por grupo y no uno por juego.
  if (!groupGame.playedAt) {
    // Las notas de ranking ("por qué propongo este juego") pierden sentido
    // una vez jugado: soft-delete de TODAS las del juego en el grupo.
    await prisma.gameComment.updateMany({
      where: { groupGameId: groupGame.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
