import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addGameSchema } from "@/lib/validations";
import { fetchBggGameDetails } from "@/lib/bgg";

// Add game to event (creator only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.createdById !== session.userId) {
    return NextResponse.json({ error: "Solo el gestor puede añadir juegos" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = addGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { bggId } = parsed.data;

  // Upsert game (same pattern as group games)
  let game = await prisma.game.findUnique({ where: { bggId } });

  if (!game) {
    // Try CollectionGame cache first
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
      try {
        const [details] = await fetchBggGameDetails([bggId]);
        if (!details) {
          return NextResponse.json({ error: "Juego no encontrado en BGG" }, { status: 404 });
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
        console.error("[Event Add Game] BGG API error:", err);
        return NextResponse.json({ error: "Error al obtener datos del juego desde BGG" }, { status: 502 });
      }
    }
  }

  // Check duplicate
  const existing = await prisma.eventGame.findUnique({
    where: { eventId_gameId: { eventId, gameId: game.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Este juego ya está en el evento" }, { status: 409 });
  }

  const eventGame = await prisma.eventGame.create({
    data: { eventId, gameId: game.id, addedById: session.userId },
    include: { game: true },
  });

  return NextResponse.json(eventGame, { status: 201 });
}
