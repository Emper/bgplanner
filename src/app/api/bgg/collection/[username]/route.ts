import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureBggCollection } from "@/lib/bgg";
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
  const sort = sp.get("sort") || "rank";
  const order = sp.get("order") || "asc";
  const search = sp.get("search") || "";

  // Filters
  const minPlayers = sp.get("minPlayers") ? parseInt(sp.get("minPlayers")!) : undefined;
  const maxPlayers = sp.get("maxPlayers") ? parseInt(sp.get("maxPlayers")!) : undefined;
  const minWeight = sp.get("minWeight") ? parseFloat(sp.get("minWeight")!) : undefined;
  const maxWeight = sp.get("maxWeight") ? parseFloat(sp.get("maxWeight")!) : undefined;
  const maxRank = sp.get("maxRank") ? parseInt(sp.get("maxRank")!) : undefined;
  const minPlays = sp.get("minPlays") ? parseInt(sp.get("minPlays")!) : undefined;

  const normalizedUsername = username.toLowerCase().trim();

  try {
    // Ensure collection is cached
    await ensureBggCollection(normalizedUsername, forceRefresh);

    // Build where clause
    const where: Prisma.CollectionGameWhereInput = {
      bggUsername: normalizedUsername,
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
    if (minPlays !== undefined) {
      where.numPlays = { gte: minPlays };
    }

    // Build orderBy — nulls go last
    const dir = order === "desc" ? "desc" : "asc";
    const nullsPos = dir === "asc" ? "last" : "first";
    let orderBy: Prisma.CollectionGameOrderByWithRelationInput;

    switch (sort) {
      case "rating":
        orderBy = { bggRating: { sort: "desc", nulls: "last" } };
        break;
      case "weight":
        orderBy = { weight: { sort: dir, nulls: nullsPos } };
        break;
      case "name":
        orderBy = { name: dir };
        break;
      case "plays":
        orderBy = { numPlays: "desc" };
        break;
      case "year":
        orderBy = { yearPublished: { sort: "desc", nulls: "last" } };
        break;
      case "rank":
      default:
        orderBy = { bggRank: { sort: "asc", nulls: "last" } };
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

    return NextResponse.json({
      items,
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
