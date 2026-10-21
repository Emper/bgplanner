import { prisma } from "@/lib/prisma";
import { requireGroupMember } from "@/lib/api";
import { compareRanking, voteScore } from "@/lib/rankingOrder";
import { GAME_NIGHT_INCLUDE } from "@/lib/gameNights";
import { isGroupManager } from "@/lib/groupTypes";
import { displayName } from "@/lib/users";

// Todo lo que pinta la ficha de un grupo para un miembro: el grupo con sus
// miembros, el ranking con votos y comentarios, las sesiones y las cifras.
// Lo usan /api/groups/[id]/dashboard (refrescos del cliente) y la página
// de servidor (primera carga). Lanza ApiError 403 si no eres miembro.
export async function getGroupDashboard(groupId: string, userId: string) {
  // Todas las consultas a la vez (la membresía, 403 si no lo es, incluida)
  const [membership, group, memberCount, groupGames, nights, manualPlaysLog] =
    await Promise.all([
      requireGroupMember(groupId, userId),
      prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  surname: true,
                  bggUsername: true,
                  avatarUrl: true,
                  slug: true,
                },
              },
            },
            orderBy: { user: { name: "asc" } },
          },
          _count: { select: { games: { where: { archivedAt: null } } } },
          invitations: {
            where: { status: "pending" },
            select: { email: true, createdAt: true },
          },
        },
      }),
      prisma.groupMember.count({ where: { groupId } }),
      prisma.groupGame.findMany({
        // Incluimos archivados: los que se hayan jugado aparecen en el
        // histórico. El cliente excluye los archivados del ranking de pendientes.
        where: { groupId },
        include: {
          game: true,
          addedBy: { select: { name: true, displayName: true } },
          votes: { select: { userId: true, value: true, user: { select: { name: true, displayName: true } } } },
          comments: { where: { deletedAt: null }, select: { userId: true, text: true, user: { select: { name: true, displayName: true } } } },
        },
      }),
      prisma.gameNight.findMany({
        where: { groupId },
        orderBy: { date: "desc" },
        include: GAME_NIGHT_INCLUDE,
      }),
      prisma.activityLog.findMany({
        where: { groupId, type: "game_marked_played" },
        select: { metadata: true, createdAt: true },
      }),
    ]);

  // Partidas por juego y última fecha jugada, desde las noches de juego
  const playCountByGameId = new Map<string, number>();
  const lastNightDateByGameId = new Map<string, Date>();
  let totalNightPlays = 0;
  let totalNightMinutes = 0;
  let lastPlayedAt: Date | null = null;
  for (const n of nights) {
    for (const ng of n.games) {
      totalNightPlays += 1;
      totalNightMinutes += ng.game.playingTime || 0;
      playCountByGameId.set(ng.game.id, (playCountByGameId.get(ng.game.id) || 0) + 1);
      const existing = lastNightDateByGameId.get(ng.game.id);
      if (!existing || n.date > existing) lastNightDateByGameId.set(ng.game.id, n.date);
    }
    if (n.games.length > 0 && (!lastPlayedAt || n.date > lastPlayedAt)) lastPlayedAt = n.date;
  }

  // Manual "marked as played" actions from the ranking. Each log entry counts
  // as one play; metadata.gameName lets us also bucket them per game so the
  // "most played" stat reflects manual marks too.
  const manualPlaysByGameName = new Map<string, number>();
  for (const log of manualPlaysLog) {
    const meta = log.metadata as { gameName?: string } | null;
    const name = meta?.gameName;
    if (name) manualPlaysByGameName.set(name, (manualPlaysByGameName.get(name) || 0) + 1);
    if (!lastPlayedAt || log.createdAt > lastPlayedAt) lastPlayedAt = log.createdAt;
  }
  const totalManualPlays = manualPlaysLog.length;

  // El ranking se calcula aquí y no con computeRanking porque esta vista
  // necesita más datos por juego (quién votó qué, comentarios, última
  // partida); el criterio de orden sí es el compartido.
  const ranking = groupGames
    .map((gg) => {
      const score = voteScore(gg.votes);

      const userVote = gg.votes.find((v) => v.userId === userId);

      // Mergeamos votos y comentarios por userId. Un voter "virtual"
      // (value = 0) representa a alguien que comentó pero retiró su voto.
      const commentByUserId = new Map(
        gg.comments.map((c) => [c.userId, c.text])
      );
      const voters = gg.votes.map((v) => ({
        userId: v.userId,
        name: displayName(v.user),
        value: v.value,
        comment: commentByUserId.get(v.userId) ?? null,
      }));
      const voterIds = new Set(voters.map((v) => v.userId));
      for (const c of gg.comments) {
        if (!voterIds.has(c.userId)) {
          voters.push({
            userId: c.userId,
            name: displayName(c.user),
            value: 0,
            comment: c.text,
          });
        }
      }

      const playCount = playCountByGameId.get(gg.game.id) || 0;
      const lastNightDate = lastNightDateByGameId.get(gg.game.id) || null;
      // Use playedAt (manual mark) or last night date, whichever is more recent
      const lastPlayedDate = gg.playedAt && lastNightDate
        ? (gg.playedAt > lastNightDate ? gg.playedAt : lastNightDate)
        : gg.playedAt || lastNightDate;

      return {
        groupGameId: gg.id,
        game: gg.game,
        addedBy: gg.addedBy,
        addedById: gg.addedById,
        score,
        voters,
        userVoteValue: userVote?.value ?? null,
        playCount,
        playedAt: gg.playedAt,
        archivedAt: gg.archivedAt,
        lastPlayedDate,
      };
    })
    .sort(compareRanking);

  // Combine night plays + manual marks per game to find the most played one
  let topGame: { name: string; thumbnail: string | null; playCount: number } | null = null;
  const combinedByGameId = new Map<string, number>(playCountByGameId);
  for (const gg of groupGames) {
    const manual = manualPlaysByGameName.get(gg.game.name) || 0;
    if (manual > 0) {
      combinedByGameId.set(gg.game.id, (combinedByGameId.get(gg.game.id) || 0) + manual);
    }
  }
  for (const gg of groupGames) {
    const count = combinedByGameId.get(gg.game.id) || 0;
    if (count > 0 && (!topGame || count > topGame.playCount)) {
      topGame = { name: gg.game.name, thumbnail: gg.game.thumbnail, playCount: count };
    }
  }

  const stats = {
    gamesCount: groupGames.filter((gg) => !gg.archivedAt).length,
    playsCount: totalNightPlays + totalManualPlays,
    totalMinutes: totalNightMinutes,
    lastPlayedAt,
    topGame,
  };

  return {
    group: {
      ...group,
      // Los emails invitados solo los ve quien gestiona las invitaciones.
      invitations: isGroupManager(membership.role) ? group?.invitations ?? [] : [],
      currentUserRole: membership.role,
      currentUserId: userId,
      currentUserLastPingedAt: membership.lastPingedAt,
    },
    ranking,
    memberCount,
    nights,
    stats,
  };
}

export type GroupDashboard = Awaited<ReturnType<typeof getGroupDashboard>>;
