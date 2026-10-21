import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSession } from "@/lib/api";
import { getMyCollection, loadCollection } from "@/lib/collectionData";

// Mi colección: los juegos del usuario logueado (los que tiene y su wishlist)
// con su puntuación de permanencia. Siempre es la colección de quien pregunta;
// no hay forma de pedir la de otro desde aquí.
//
// Devuelve la colección entera de una vez y sin filtrar: filtrar, ordenar y
// paginar lo hace el navegador. Con `refresh=true` la trae antes de BGG; sin
// él, lo cacheado (ver getMyCollection).
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const sp = request.nextUrl.searchParams;

  // La vitrina del perfil solo necesita los juegos marcados: no tiene
  // sentido mandarle la colección entera (ni la puntuación de cada uno).
  if (sp.get("showcase") === "true") {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { bggUsername: true },
    });
    if (!user?.bggUsername) return NextResponse.json({ connected: false, items: [] });
    const { items } = await loadCollection(session.userId, user.bggUsername);
    return NextResponse.json({
      connected: true,
      items: items
        .filter((i) => i.showcased)
        .map((i) => ({ bggId: i.bggId, name: i.name, image: i.image, thumbnail: i.thumbnail })),
    });
  }

  return NextResponse.json(
    await getMyCollection(session.userId, { refresh: sp.get("refresh") === "true" })
  );
});
