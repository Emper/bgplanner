import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireSession } from "@/lib/api";
import { ensureBggCollection, normalizeBggUsername } from "@/lib/bgg";
import { DEFAULT_SORT_DIR } from "@/lib/collection";
import { matchByName } from "@/lib/collectionData";

type Params = { params: Promise<{ username: string }> };

// Los órdenes que entiende esta ruta; cualquier otro cae al ranking de BGG.
const SORTS = ["added", "rank", "rating", "weight", "name", "plays", "year"] as const;
type Sort = (typeof SORTS)[number];

// Un número de la URL, o undefined si no viene o no es un número (antes un
// `?minPlayers=abc` llegaba a Prisma como NaN y daba un 500).
function numberParam(sp: URLSearchParams, key: string, parse: (v: string) => number) {
  const raw = sp.get(key);
  if (!raw) return undefined;
  const n = parse(raw);
  return Number.isFinite(n) ? n : undefined;
}

// La colección de un miembro del grupo, paginada y filtrada en el servidor,
// para elegir juegos que añadir. Solo juegos base que tiene (no la wishlist:
// no puedes llevar a la mesa un juego que no tienes), cada uno con sus
// expansiones.
export const GET = apiHandler(async (request: NextRequest, { params }: Params) => {
  await requireSession(request);

  const { username } = await params;
  const sp = request.nextUrl.searchParams;
  const forceRefresh = sp.get("refresh") === "true";
  const page = Math.max(1, numberParam(sp, "page", (v) => parseInt(v, 10)) ?? 1);
  const pageSize = Math.min(100, Math.max(1, numberParam(sp, "pageSize", (v) => parseInt(v, 10)) ?? 24));
  const rawSort = sp.get("sort") || "added";
  const sort: Sort = (SORTS as readonly string[]).includes(rawSort) ? (rawSort as Sort) : "rank";
  const order = sp.get("order") || "";
  const search = sp.get("search") || "";

  // Filtros
  const int = (v: string) => parseInt(v, 10);
  const minPlayers = numberParam(sp, "minPlayers", int);
  const maxPlayers = numberParam(sp, "maxPlayers", int);
  const minWeight = numberParam(sp, "minWeight", parseFloat);
  const maxWeight = numberParam(sp, "maxWeight", parseFloat);
  const maxRank = numberParam(sp, "maxRank", int);
  const minPlays = numberParam(sp, "minPlays", int);
  const unplayed = sp.get("unplayed") === "true";

  const bggUsername = normalizeBggUsername(username);

  try {
    // Que la colección esté en caché (juegos base y expansiones)
    await ensureBggCollection(bggUsername, forceRefresh);
  } catch (error) {
    console.error("[Colección de BGG] No se pudo traer:", error);
    throw new ApiError(502, "BGG no ha respondido. Prueba de nuevo en un rato");
  }

  const where: Prisma.CollectionGameWhereInput = {
    bggUsername,
    subtype: "boardgame",
    status: "own",
  };

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (minPlayers !== undefined) {
    where.maxPlayers = { gte: minPlayers };
  }
  if (maxPlayers !== undefined) {
    where.minPlayers = { lte: maxPlayers };
  }
  if (minWeight !== undefined || maxWeight !== undefined) {
    where.weight = {
      ...(minWeight !== undefined ? { gte: minWeight } : {}),
      ...(maxWeight !== undefined ? { lte: maxWeight } : {}),
    };
  }
  if (maxRank !== undefined) {
    where.bggRank = { lte: maxRank };
  }
  if (unplayed) {
    where.numPlays = 0;
  } else if (minPlays !== undefined) {
    where.numPlays = { gte: minPlays };
  }

  // Cada orden tiene su sentido natural; `order` lo cambia
  const dir: "asc" | "desc" = order === "asc" || order === "desc" ? order : DEFAULT_SORT_DIR[sort];
  const nullsPos = dir === "asc" ? "last" : "first";
  let orderBy: Prisma.CollectionGameOrderByWithRelationInput;

  switch (sort) {
    case "added":
      orderBy = { dateAdded: { sort: dir, nulls: "last" } };
      break;
    case "rating":
      orderBy = { bggRating: { sort: dir, nulls: "last" } };
      break;
    case "weight":
      orderBy = { weight: { sort: dir, nulls: nullsPos } };
      break;
    case "name":
      orderBy = { name: dir };
      break;
    case "plays":
      orderBy = { numPlays: dir };
      break;
    case "year":
      orderBy = { yearPublished: { sort: dir, nulls: "last" } };
      break;
    case "rank":
      orderBy = { bggRank: { sort: dir, nulls: "last" } };
      break;
  }

  const [items, total] = await Promise.all([
    prisma.collectionGame.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.collectionGame.count({ where }),
  ]);

  const expansionsByBaseGame = await expansionsForPage(bggUsername, items);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      expansions: expansionsByBaseGame.get(item.bggId) || [],
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

type ExpansionView = { bggId: number; name: string; thumbnail: string | null };

/**
 * Las expansiones que tiene de los juegos de esta página, emparejadas como en
 * "Mi colección" (loadCollection): primero el enlace real de BGG y, si no lo
 * hay, la heurística del nombre. Solo se piden las que pueden caer aquí, no
 * todas las de la colección.
 */
async function expansionsForPage(
  bggUsername: string,
  items: { bggId: number; name: string }[]
): Promise<Map<number, ExpansionView[]>> {
  const byBase = new Map<number, ExpansionView[]>();
  if (items.length === 0) return byBase;

  const pageIds = new Set(items.map((i) => i.bggId));
  const expansions = await prisma.collectionGame.findMany({
    where: {
      bggUsername,
      subtype: "boardgameexpansion",
      status: "own",
      OR: [
        { baseBggId: { in: [...pageIds] } },
        ...items.map((item) => ({
          name: { startsWith: item.name, mode: "insensitive" as const },
        })),
      ],
    },
    select: { bggId: true, name: true, thumbnail: true, baseBggId: true },
  });

  // Las que BGG enlaza con un juego de la colección que no está en esta
  // página se quedan con el suyo: la heurística podría colgarlas de otro.
  const linkedElsewhere = [
    ...new Set(
      expansions
        .map((e) => e.baseBggId)
        .filter((id): id is number => !!id && !pageIds.has(id))
    ),
  ];
  const basesElsewhere = new Set(
    linkedElsewhere.length > 0
      ? (
          await prisma.collectionGame.findMany({
            where: {
              bggUsername,
              subtype: { not: "boardgameexpansion" },
              bggId: { in: linkedElsewhere },
            },
            select: { bggId: true },
          })
        ).map((r) => r.bggId)
      : []
  );

  const baseNames = items.map((i) => ({ bggId: i.bggId, name: i.name }));
  for (const exp of expansions) {
    let baseId = exp.baseBggId && pageIds.has(exp.baseBggId) ? exp.baseBggId : null;
    if (baseId === null) {
      if (exp.baseBggId && basesElsewhere.has(exp.baseBggId)) continue;
      baseId = matchByName(exp.name, baseNames);
    }
    if (baseId === null) continue;
    const view = { bggId: exp.bggId, name: exp.name, thumbnail: exp.thumbnail };
    const list = byBase.get(baseId);
    if (list) list.push(view);
    else byBase.set(baseId, [view]);
  }
  return byBase;
}
