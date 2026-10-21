import { prisma } from "@/lib/prisma";
import { compareRanking, voteScore } from "@/lib/rankingOrder";

/**
 * El ranking del grupo. Con `pendingOnly` solo entran los que quedan por
 * jugar, que es lo que la gente entiende por «el ranking» (la pestaña de
 * pendientes, el top 3 de la convocatoria): sin jugados ni archivados.
 */
export async function computeRanking(
  groupId: string,
  viewerUserId?: string,
  { pendingOnly = false }: { pendingOnly?: boolean } = {}
) {
  const [groupGames, completedPlays] = await Promise.all([
    prisma.groupGame.findMany({
      where: {
        groupId,
        ...(pendingOnly ? { archivedAt: null, playedAt: null } : {}),
      },
      include: {
        game: true,
        addedBy: { select: { name: true } },
        votes: { select: { userId: true, value: true } },
      },
    }),
    prisma.gameNightGame.groupBy({
      by: ["gameId"],
      where: { night: { groupId } },
      _count: { id: true },
    }),
  ]);

  const playCountByGameId = new Map(
    completedPlays.map((p) => [p.gameId, p._count.id])
  );

  return groupGames
    .map((gg) => {
      const score = voteScore(gg.votes);

      const upVotes = gg.votes.filter((v) => v.value === 1).length;
      const superVotes = gg.votes.filter((v) => v.value >= 3).length;
      const downVotes = gg.votes.filter((v) => v.value < 0).length;
      const userVote = viewerUserId
        ? gg.votes.find((v) => v.userId === viewerUserId)
        : undefined;

      return {
        groupGameId: gg.id,
        game: gg.game,
        addedBy: gg.addedBy,
        addedById: gg.addedById,
        score,
        upVotes,
        superVotes,
        downVotes,
        userVoteValue: userVote?.value ?? null,
        playCount: playCountByGameId.get(gg.game.id) || 0,
      };
    })
    .sort(compareRanking);
}
