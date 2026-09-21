import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureBggCollection } from "@/lib/bgg";
import {
  loadCollection,
  DEFAULT_SORT_DIR,
  type CollectionQuery,
  type CollectionSort,
} from "@/lib/collection";

const SORTS = Object.keys(DEFAULT_SORT_DIR) as CollectionSort[];

function intParam(sp: URLSearchParams, key: string): number | undefined {
  const raw = sp.get(key);
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function floatParam(sp: URLSearchParams, key: string): number | undefined {
  const raw = sp.get(key);
  if (!raw) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

// Mi colección: los juegos del usuario logueado (los que tiene y su wishlist)
// con su puntuación de permanencia. Siempre es la colección de quien pregunta;
// no hay forma de pedir la de otro desde aquí.
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
    return NextResponse.json({
      connected: false,
      items: [],
      total: 0,
      totalPages: 0,
      stats: null,
    });
  }

  const sp = request.nextUrl.searchParams;
  const sortParam = sp.get("sort") || "added";
  const orderParam = sp.get("order");
  const statusParam = sp.get("status");

  const query: CollectionQuery = {
    status:
      statusParam === "wishlist" || statusParam === "all" ? statusParam : "own",
    search: sp.get("search") || "",
    keep: sp.get("keep") || "",
    players: intParam(sp, "players"),
    minPlays: intParam(sp, "minPlays"),
    unplayed: sp.get("unplayed") === "true",
    myRating: sp.get("myRating") || "",
    maxRank: intParam(sp, "maxRank"),
    minWeight: floatParam(sp, "minWeight"),
    maxWeight: floatParam(sp, "maxWeight"),
    showcased: sp.get("showcased") === "true",
    sort: (SORTS as string[]).includes(sortParam)
      ? (sortParam as CollectionSort)
      : "added",
    order: orderParam === "asc" || orderParam === "desc" ? orderParam : "",
    page: Math.max(1, intParam(sp, "page") ?? 1),
    pageSize: Math.min(120, Math.max(1, intParam(sp, "pageSize") ?? 24)),
  };

  try {
    await ensureBggCollection(user.bggUsername, sp.get("refresh") === "true");
  } catch (error) {
    // Si BGG no responde seguimos con lo que tengamos cacheado: es mucho mejor
    // enseñar una colección de hace dos días que una página de error.
    console.error("[Mi colección] BGG no disponible:", error);
  }

  const { items, total, stats } = await loadCollection(
    session.userId,
    user.bggUsername,
    query
  );

  // Cuántas expansiones siguen sin saber de qué juego son: la página lanza el
  // enriquecimiento en segundo plano mientras el usuario mira la lista.
  const pendingLinks = await prisma.collectionGame.count({
    where: {
      bggUsername: user.bggUsername.toLowerCase().trim(),
      subtype: "boardgameexpansion",
      baseBggId: null,
    },
  });

  return NextResponse.json({
    connected: true,
    bggUsername: user.bggUsername,
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
    stats,
    pendingLinks,
  });
}
