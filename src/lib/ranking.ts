import { prisma } from "@/lib/prisma";

export async function computeRanking(
  groupId: string,
  viewerUserId?: string
) {
  const [groupGames, completedPlays] = await Promise.all([
    prisma.groupGame.findMany({
      where: { groupId },
      include: {
        game: true,
        addedBy: { select: { name: true } },
        votes: { select: { userId: true, value: true } },
      },
    }),
    prisma.gameSessionGame.groupBy({
      by: ["gameId"],
      where: {
        status: "completed",
        session: { groupId },
      },
      _count: { id: true },
    }),
  ]);

  const playCountByGameId = new Map(
    completedPlays.map((p) => [p.gameId, p._count.id])
  );

  return groupGames
    .map((gg) => {
      const score = gg.votes.reduce((acc, v) => acc + v.value, 0);

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
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.game.bggRating || 0) - (a.game.bggRating || 0);
    });
}
