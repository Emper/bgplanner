import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Datos de la pantalla de Inicio.
 *
 * Responde a las tres preguntas con las que se abre la app: qué se juega
 * pronto, dónde falta que vote y qué ha pasado desde la última vez. Va todo
 * en una sola llamada porque en móvil cada petición extra se nota.
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.userId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const [sessions, events, groups, myVotes, activity] = await Promise.all([
    // Próximas partidas planificadas en mis grupos.
    prisma.gameSession.findMany({
      where: {
        groupId: { in: groupIds },
        date: { gte: now },
        status: { not: "completed" },
      },
      include: {
        group: { select: { id: true, name: true } },
        games: { include: { game: { select: { name: true, thumbnail: true } } } },
      },
      orderBy: { date: "asc" },
      take: 3,
    }),

    // Próximos eventos a los que voy o que he creado.
    prisma.event.findMany({
      where: {
        date: { gte: now },
        OR: [
          { createdById: session.userId },
          { attendees: { some: { userId: session.userId, status: { not: "cancelled" } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        imageUrl: true,
        _count: { select: { attendees: true, games: true } },
      },
      orderBy: { date: "asc" },
      take: 3,
    }),

    // Juegos activos por grupo, para calcular lo que falta por votar.
    prisma.group.findMany({
      where: { id: { in: groupIds } },
      select: {
        id: true,
        name: true,
        games: {
          where: { archivedAt: null },
          select: { id: true },
        },
      },
    }),

    prisma.vote.findMany({
      where: { userId: session.userId },
      select: { groupGameId: true },
    }),

    // Actividad reciente de mis grupos, sin la mía propia: lo interesante es
    // lo que han hecho los demás.
    prisma.activityLog.findMany({
      where: {
        groupId: { in: groupIds },
        userId: { not: session.userId },
      },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const votedIds = new Set(myVotes.map((v) => v.groupGameId));
  const pendingVotes = groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      pending: group.games.filter((g) => !votedIds.has(g.id)).length,
      total: group.games.length,
    }))
    .filter((g) => g.pending > 0)
    .sort((a, b) => b.pending - a.pending);

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date,
      playerCount: s.playerCount,
      group: s.group,
      games: s.games.map((g) => ({
        name: g.game.name,
        thumbnail: g.game.thumbnail,
      })),
    })),
    events,
    pendingVotes,
    activity,
    groupCount: groupIds.length,
  });
}
