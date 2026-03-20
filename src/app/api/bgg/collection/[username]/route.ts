import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureBggCollection, enrichCollectionGames } from "@/lib/bgg";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { username } = await params;
  const sp = request.nextUrl.searchParams;
  const forceRefresh = sp.get("refresh") === "true";
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "24")));
  const sort = sp.get("sort") || "added";
  const order = sp.get("order") || "";
  const search = sp.get("search") || "";

  // Filters
  const minPlayers = sp.get("minPlayers") ? parseInt(sp.get("minPlayers")!) : undefined;
  const maxPlayers = sp.get("maxPlayers") ? parseInt(sp.get("maxPlayers")!) : undefined;
  const minWeight = sp.get("minWeight") ? parseFloat(sp.get("minWeight")!) : undefined;
  const maxWeight = sp.get("maxWeight") ? parseFloat(sp.get("maxWeight")!) : undefined;
  const maxRank = sp.get("maxRank") ? parseInt(sp.get("maxRank")!) : undefined;
  const minPlays = sp.get("minPlays") ? parseInt(sp.get("minPlays")!) : undefined;
  const unplayed = sp.get("unplayed") === "true";

  const normalizedUsername = username.toLowerCase().trim();

  try {
    // Ensure collection is cached (fetches both boardgames + expansions)
    await ensureBggCollection(normalizedUsername, forceRefresh);

    // Build where clause — only base games (exclude expansions)
    const where: Prisma.CollectionGameWhereInput = {
      bggUsername: normalizedUsername,
      subtype: "boardgame",
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
    if (minWeight !== undefined) {
      where.weight = { ...(where.weight as object || {}), gte: minWeight };
    }
    if (maxWeight !== undefined) {
      where.weight = { ...(where.weight as object || {}), lte: maxWeight };
    }
    if (maxRank !== undefined) {
      where.bggRank = { lte: maxRank };
    }
    if (unplayed) {
      where.numPlays = 0;
    } else if (minPlays !== undefined) {
      where.numPlays = { gte: minPlays };
    }

    // Each sort has a natural default direction; explicit order overrides it
    const sortDefaults: Record<string, "asc" | "desc"> = {
      added: "desc",   // newest first
      rank: "asc",     // #1 first
      rating: "desc",  // highest first
      weight: "asc",   // lightest first
      name: "asc",     // A-Z
      plays: "desc",   // most played first
      year: "desc",    // newest first
    };

    const dir: "asc" | "desc" = order === "asc" || order === "desc" ? order : (sortDefaults[sort] ?? "asc");
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
      default:
        orderBy = { bggRank: { sort: dir, nulls: "last" } };
        break;
    }

    // First fetch items and total count
    const [items, total] = await Promise.all([
      prisma.collectionGame.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.collectionGame.count({ where }),
    ]);

    // Then fetch only expansions that could match current page items (by name prefix)
    // This is much faster than fetching ALL expansions for the user
    const nameFilters = items.map((item) => ({
      name: { startsWith: item.name, mode: "insensitive" as const },
    }));

    const expansions = nameFilters.length > 0
      ? await prisma.collectionGame.findMany({
          where: {
            bggUsername: normalizedUsername,
            subtype: "boardgameexpansion",
            OR: nameFilters,
          },
          select: { bggId: true, name: true, thumbnail: true },
        })
      : [];

    // Match expansions to base games by name prefix
    const expansionsByBaseGame = new Map<number, { bggId: number; name: string; thumbnail: string | null }[]>();

    for (const exp of expansions) {
      let bestMatch: number | null = null;
      let bestMatchLen = 0;

      for (const item of items) {
        const baseName = item.name.toLowerCase();
        const expName = exp.name.toLowerCase();

        if (
          (expName.startsWith(baseName + ":") ||
            expName.startsWith(baseName + " –") ||
            expName.startsWith(baseName + " -") ||
            (expName.startsWith(baseName) && expName.length > baseName.length)) &&
          baseName.length > bestMatchLen
        ) {
          bestMatch = item.bggId;
          bestMatchLen = baseName.length;
        }
      }

      if (bestMatch !== null) {
        if (!expansionsByBaseGame.has(bestMatch)) {
          expansionsByBaseGame.set(bestMatch, []);
        }
        expansionsByBaseGame.get(bestMatch)!.push({
          bggId: exp.bggId,
          name: exp.name,
          thumbnail: exp.thumbnail,
        });
      }
    }

    // Add expansion info to items
    const itemsWithExpansions = items.map((item) => ({
      ...item,
      expansions: expansionsByBaseGame.get(item.bggId) || [],
    }));

    return NextResponse.json({
      items: itemsWithExpansions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al obtener colección";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
