import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { searchBggGames } from "@/lib/bgg";

// Busca juegos en todo BGG (fuera de la colección) y anota, para cada
// resultado, qué miembros del grupo lo tienen en su colección cacheada.
// Un resultado con `owners` vacío = "nadie del grupo lo tiene".
export async function GET(
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

  const query = request.nextUrl.searchParams.get("q") || "";
  if (query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchBggGames(query);
  if (results.length === 0) {
    return NextResponse.json([]);
  }

  // Miembros del grupo con cuenta BGG → mapa username → nombre visible.
  const members = await prisma.groupMember.findMany({
    where: { groupId, user: { bggUsername: { not: null } } },
    select: {
      user: {
        select: { name: true, displayName: true, email: true, bggUsername: true },
      },
    },
  });

  const usernameToName = new Map<string, string>();
  for (const m of members) {
    const u = m.user;
    if (!u.bggUsername) continue;
    usernameToName.set(
      u.bggUsername.toLowerCase().trim(),
      u.displayName || u.name || u.email
    );
  }

  // Qué juegos (de entre los resultados) tiene cada username en su colección.
  const ownedByUsername =
    usernameToName.size > 0
      ? await prisma.collectionGame.findMany({
          where: {
            bggUsername: { in: Array.from(usernameToName.keys()) },
            bggId: { in: results.map((r) => r.bggId) },
          },
          select: { bggId: true, bggUsername: true },
        })
      : [];

  const ownersByGame = new Map<number, Set<string>>();
  for (const row of ownedByUsername) {
    const name = usernameToName.get(row.bggUsername.toLowerCase().trim());
    if (!name) continue;
    if (!ownersByGame.has(row.bggId)) ownersByGame.set(row.bggId, new Set());
    ownersByGame.get(row.bggId)!.add(name);
  }

  const annotated = results.map((r) => ({
    ...r,
    owners: Array.from(ownersByGame.get(r.bggId) ?? []),
  }));

  return NextResponse.json(annotated);
}
