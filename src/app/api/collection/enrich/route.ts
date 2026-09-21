import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { enrichCollectionGames } from "@/lib/bgg";

// BGG solo admite 20 juegos por llamada a `thing` y hay que espaciarlas, así
// que cada petición enriquece un lote y la página vuelve a llamar hasta que
// `remaining` llega a cero. Así no se agota el tiempo de la función.
const BATCH_SIZE = 20;

// Completa los datos que el listado de colección de BGG no trae: de qué juego
// es cada expansión y con cuántos jugadores va mejor. Se llama desde "Mi
// colección" en segundo plano, sin bloquear la vista.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { bggUsername: true },
  });
  if (!user?.bggUsername) {
    return NextResponse.json({ error: "Sin usuario de BGG" }, { status: 400 });
  }

  const bggUsername = user.bggUsername.toLowerCase().trim();
  const pending = await prisma.collectionGame.findMany({
    where: { bggUsername, subtype: "boardgameexpansion", baseBggId: null },
    select: { bggId: true },
    orderBy: { name: "asc" },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return NextResponse.json({ enriched: 0, remaining: 0 });
  }

  const result = await enrichCollectionGames(pending.map((g) => g.bggId));

  // De las que BGG sí ha contestado, las que aun así no tienen juego base
  // (expansiones sueltas, promos) se marcan con baseBggId = 0: "preguntado,
  // sin respuesta". Si no, seguirían pendientes para siempre y el bucle no
  // acabaría nunca. Las que BGG no ha contestado se quedan como están, para
  // volver a intentarlo: un fallo pasajero no debe darlas por perdidas.
  if (result.answered.length > 0) {
    await prisma.collectionGame.updateMany({
      where: {
        bggUsername,
        bggId: { in: result.answered },
        baseBggId: null,
      },
      data: { baseBggId: 0 },
    });
  }

  const remaining = await prisma.collectionGame.count({
    where: { bggUsername, subtype: "boardgameexpansion", baseBggId: null },
  });

  return NextResponse.json({
    enriched: result.baseLinks,
    answered: result.answered.length,
    remaining,
  });
}
