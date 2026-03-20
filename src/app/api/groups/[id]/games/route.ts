import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { addGameSchema } from "@/lib/validations";
import { fetchBggGameDetails } from "@/lib/bgg";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  // Run membership check and data fetch in parallel
  const [membership, groupGames] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId } },
    }),
    prisma.groupGame.findMany({
      where: { groupId },
      include: {
        game: true,
        addedBy: { select: { name: true } },
        votes: { select: { userId: true, type: true } },
        _count: { select: { votes: true } },
      },
    }),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const gamesWithScores = groupGames.map((gg) => {
    const score = gg.votes.reduce((acc, v) => {
      if (v.type === "super") return acc + 3;
      if (v.type === "down") return acc - 1;
      return acc + 1;
    }, 0);

    const userVote = gg.votes.find((v) => v.userId === session.userId);

    return {
      id: gg.id,
      game: gg.game,
      addedBy: gg.addedBy,
      addedAt: gg.addedAt,
      score,
      voteCount: gg._count.votes,
      userVote: userVote?.type || null,
      votes: gg.votes,
    };
  });

  gamesWithScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.game.bggRating || 0) - (a.game.bggRating || 0);
  });

  return NextResponse.json(gamesWithScores);
}

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

  const body = await request.json();
  const parsed = addGameSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { bggId } = parsed.data;

  // Check if game already in group
  let game = await prisma.game.findUnique({ where: { bggId } });

  if (!game) {
    // Try to find the game in the CollectionGame cache via raw query
    // (avoids Prisma client type cache issues on Vercel)
    type CachedRow = {
      name: string;
      thumbnail: string | null;
      yearPublished: number | null;
      minPlayers: number | null;
      maxPlayers: number | null;
      playingTime: number | null;
      bggRating: number | null;
      bggRank: number | null;
      weight: number | null;
    };
    const cachedRows = await prisma.$queryRaw<CachedRow[]>`
      SELECT name, thumbnail, "yearPublished", "minPlayers", "maxPlayers",
             "playingTime", "bggRating", "bggRank", weight
      FROM "CollectionGame"
      WHERE "bggId" = ${bggId}
      LIMIT 1
    `;
    const cachedItem = cachedRows[0] ?? null;

    if (cachedItem) {
      // Use cached collection data — no BGG API call needed
      game = await prisma.game.create({
        data: {
          bggId,
          name: cachedItem.name,
          thumbnail: cachedItem.thumbnail,
          yearPublished: cachedItem.yearPublished,
          minPlayers: cachedItem.minPlayers,
          maxPlayers: cachedItem.maxPlayers,
          playingTime: cachedItem.playingTime,
          bggRating: cachedItem.bggRating,
          bggRank: cachedItem.bggRank,
          weight: cachedItem.weight,
        },
      });
    } else {
      // Fallback: fetch from BGG API
      try {
        const [details] = await fetchBggGameDetails([bggId]);
        if (!details) {
          return NextResponse.json(
            { error: "Juego no encontrado en BGG" },
            { status: 404 }
          );
        }

        game = await prisma.game.create({
          data: {
            bggId,
            name: details.name,
            thumbnail: details.thumbnail,
            yearPublished: details.yearPublished,
            minPlayers: details.minPlayers,
            maxPlayers: details.maxPlayers,
            bggRating: details.bggRating,
            bggRank: details.bggRank,
            weight: details.weight,
          },
        });
      } catch (err) {
        console.error("[Add Game] BGG API error:", err);
        return NextResponse.json(
          { error: "Error al obtener datos del juego desde BGG. Inténtalo de nuevo." },
          { status: 502 }
        );
      }
    }
  }

  // Check duplicate
  const existing = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId: game!.id } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Este juego ya está en el grupo" },
      { status: 409 }
    );
  }

  const groupGame = await prisma.groupGame.create({
    data: {
      groupId,
      gameId: game!.id,
      addedById: session.userId,
    },
    include: { game: true },
  });

  return NextResponse.json(groupGame, { status: 201 });
}
