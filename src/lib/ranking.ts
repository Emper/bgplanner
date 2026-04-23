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
        votes: { select: { userId: true, type: true } },
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
      const score = gg.votes.reduce((acc, v) => {
        if (v.type === "super") return acc + 3;
        if (v.type === "down") return acc - 1;
        return acc + 1;
      }, 0);

      const upVotes = gg.votes.filter((v) => v.type === "up").length;
      const superVotes = gg.votes.filter((v) => v.type === "super").length;
      const downVotes = gg.votes.filter((v) => v.type === "down").length;
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
        userVote: userVote?.type || null,
        playCount: playCountByGameId.get(gg.game.id) || 0,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.game.bggRating || 0) - (a.game.bggRating || 0);
    });
}
