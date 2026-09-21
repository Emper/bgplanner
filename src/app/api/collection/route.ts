import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureBggCollection, isCollectionStale } from "@/lib/bgg";
import { loadCollection } from "@/lib/collectionData";

// Mi colección: los juegos del usuario logueado (los que tiene y su wishlist)
// con su puntuación de permanencia. Siempre es la colección de quien pregunta;
// no hay forma de pedir la de otro desde aquí.
//
// Devuelve la colección entera de una vez y sin filtrar: filtrar, ordenar y
// paginar lo hace el navegador. Y salvo que se pida `refresh=true`, NO habla
// con BGG: contesta con lo que hay en caché y marca `stale` para que la
// página lance la sincronización aparte, enseñando mientras tanto los datos
// viejos. Antes el primer GET con la caché caducada se quedaba esperando
// varios segundos a tres llamadas a BGG antes de pintar nada.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { bggUsername: true },
  });

  if (!user?.bggUsername) {
    return NextResponse.json({ connected: false, items: [] });
  }

  const sp = request.nextUrl.searchParams;
  const refresh = sp.get("refresh") === "true";
  // La vitrina del perfil solo necesita los juegos marcados: no tiene
  // sentido mandarle la colección entera (ni la puntuación de cada uno).
  const showcaseOnly = sp.get("showcase") === "true";
  let syncError: string | null = null;

  if (refresh) {
    try {
      await ensureBggCollection(user.bggUsername, true);
    } catch (error) {
      // Si BGG falla seguimos con lo cacheado: es mucho mejor enseñar una
      // colección de hace dos días que una página de error.
      syncError =
        error instanceof Error ? error.message : "BGG no ha respondido";
      console.error("[Mi colección] BGG no disponible:", error);
    }
  }

  const { items, pendingLinks, fetchedAt } = await loadCollection(
    session.userId,
    user.bggUsername
  );

  if (showcaseOnly) {
    return NextResponse.json({
      connected: true,
      items: items
        .filter((i) => i.showcased)
        .map((i) => ({
          bggId: i.bggId,
          name: i.name,
          image: i.image,
          thumbnail: i.thumbnail,
        })),
    });
  }

  return NextResponse.json({
    connected: true,
    bggUsername: user.bggUsername,
    items,
    pendingLinks,
    fetchedAt: fetchedAt ? fetchedAt.toISOString() : null,
    // `empty` = nunca se ha sincronizado; `stale` = toca refrescar.
    empty: items.length === 0,
    stale: isCollectionStale(fetchedAt),
    syncError,
  });
}
