import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { CollectionGame } from "@prisma/client";
import type { CollectionItemView } from "@/lib/collection";

// ── Emparejado de expansiones ───────────────────────────────────────────

// Cuando BGG todavía no nos ha dicho de qué juego es una expansión, caemos a
// la heurística de siempre: el nombre de la expansión empieza por el del
// juego base. Nos quedamos con la coincidencia más larga (para que "Brass:
// Birmingham – X" no acabe colgando de "Brass").
function matchByName(
  expansionName: string,
  baseNames: { bggId: number; name: string }[]
): number | null {
  const expName = expansionName.toLowerCase();
  let best: number | null = null;
  let bestLen = 0;

  for (const base of baseNames) {
    const baseName = base.name.toLowerCase();
    if (baseName.length <= bestLen) continue;
    if (
      expName.startsWith(baseName + ":") ||
      expName.startsWith(baseName + " –") ||
      expName.startsWith(baseName + " -") ||
      (expName.startsWith(baseName) && expName.length > baseName.length)
    ) {
      best = base.bggId;
      bestLen = baseName.length;
    }
  }
  return best;
}

/**
 * Trae la colección entera del usuario, agrupada (cada juego base con sus
 * expansiones dentro) y con la puntuación de permanencia ya resuelta.
 *
 * Devuelve TODO, sin filtrar ni paginar: el navegador se queda la colección
 * completa y filtra, ordena y pagina en local. Son un par de cientos de
 * fichas, unas decenas de kB comprimidas, y a cambio cambiar de orden o de
 * filtro es instantáneo en vez de un viaje al servidor por cada clic.
 */
export async function loadCollection(
  userId: string,
  bggUsername: string
): Promise<{
  items: CollectionItemView[];
  /** Expansiones que aún no sabemos de qué juego son. */
  pendingLinks: number;
  /** Cuándo se trajo esto de BGG por última vez. */
  fetchedAt: Date | null;
}> {
  const [rows, entries] = await Promise.all([
    prisma.collectionGame.findMany({
      where: { bggUsername: bggUsername.toLowerCase().trim() },
    }),
    prisma.collectionEntry.findMany({ where: { userId } }),
  ]);

  const entryByBggId = new Map(entries.map((e) => [e.bggId, e]));

  const bases = rows.filter((r) => r.subtype !== "boardgameexpansion");
  const expansions = rows.filter((r) => r.subtype === "boardgameexpansion");
  const baseById = new Map(bases.map((b) => [b.bggId, b]));
  const baseNames = bases.map((b) => ({ bggId: b.bggId, name: b.name }));

  // Expansión → juego base. Primero el enlace real de BGG; si no lo tenemos
  // (o apunta a un juego que no está en la colección), la heurística.
  const expansionsByBase = new Map<number, CollectionGame[]>();
  const orphanExpansions: CollectionGame[] = [];
  const parentOf = new Map<number, number>();

  for (const exp of expansions) {
    let baseId =
      exp.baseBggId && baseById.has(exp.baseBggId) ? exp.baseBggId : null;
    if (baseId === null) baseId = matchByName(exp.name, baseNames);

    // Una expansión de la wishlist no se cuelga de un juego que ya tienes:
    // son decisiones distintas ("lo quiero" vs "me lo quedo").
    if (baseId !== null && baseById.get(baseId)!.status === exp.status) {
      const list = expansionsByBase.get(baseId);
      if (list) list.push(exp);
      else expansionsByBase.set(baseId, [exp]);
      parentOf.set(exp.bggId, baseId);
    } else {
      orphanExpansions.push(exp);
    }
  }

  // La puntuación de un juego: la suya, y si no tiene, la del juego base.
  const keepScoreOf = (row: CollectionGame): number | null => {
    const own = entryByBggId.get(row.bggId)?.keepScore ?? null;
    if (own !== null) return own;
    const parentId = parentOf.get(row.bggId);
    if (parentId === undefined) return null;
    return entryByBggId.get(parentId)?.keepScore ?? null;
  };

  const toView = (row: CollectionGame): CollectionItemView => {
    const entry = entryByBggId.get(row.bggId);
    const own = expansionsByBase.get(row.bggId) ?? [];
    return {
      bggId: row.bggId,
      name: row.name,
      thumbnail: row.thumbnail,
      image: row.image,
      yearPublished: row.yearPublished,
      minPlayers: row.minPlayers,
      maxPlayers: row.maxPlayers,
      playingTime: row.playingTime,
      weight: row.weight,
      bggRating: row.bggRating,
      bggRank: row.bggRank,
      bestWith: row.bestWith,
      numPlays: row.numPlays,
      userRating: row.userRating,
      dateAdded: row.dateAdded ? row.dateAdded.toISOString() : null,
      status: row.status,
      wishlistPriority: row.wishlistPriority,
      isExpansion: row.subtype === "boardgameexpansion",
      keepScore: keepScoreOf(row),
      note: entry?.note ?? null,
      showcased: entry?.showcased ?? false,
      expansions: own
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => ({
          bggId: e.bggId,
          name: e.name,
          thumbnail: e.thumbnail,
          yearPublished: e.yearPublished,
          numPlays: e.numPlays,
          userRating: e.userRating,
          status: e.status,
          ownKeepScore: entryByBggId.get(e.bggId)?.keepScore ?? null,
        })),
      expansionPlays: own.reduce((sum, e) => sum + e.numPlays, 0),
    };
  };

  // Las expansiones sueltas (sin juego base en la colección) salen como una
  // ficha más: si no, desaparecerían de la lista sin explicación.
  const items = [...bases, ...orphanExpansions].map(toView);

  let fetchedAt: Date | null = null;
  for (const row of rows) {
    if (!fetchedAt || row.fetchedAt > fetchedAt) fetchedAt = row.fetchedAt;
  }

  return {
    items,
    pendingLinks: expansions.filter((e) => e.baseBggId === null).length,
    fetchedAt,
  };
}


// ── Enlace compartido ───────────────────────────────────────────────────

/**
 * El dueño de un enlace de colección compartida. Va con `cache` de React
 * porque en la misma petición lo piden generateMetadata y la página.
 */
export const findCollectionOwner = cache(async (token: string) =>
  prisma.user.findUnique({
    where: { collectionShareToken: token },
    select: { id: true, name: true, displayName: true, bggUsername: true },
  })
);

/**
 * Las portadas que salen en la balda de la tarjeta al compartir el enlace.
 * En orden de preferencia:
 *
 *   1. La vitrina, que son los que el dueño ha elegido a mano para enseñar.
 *   2. Los que ha jurado no soltar: "no se irá nunca" y luego "se queda".
 *   3. Los mejor colocados en el ranking de BGG, para quien acaba de
 *      conectar su cuenta y todavía no ha puntuado nada.
 *
 * Así la tarjeta nunca sale vacía y, cuanto más cuidada esté la colección,
 * más se parece a lo que su dueño enseñaría de verdad.
 */
export async function pickShelfCovers(
  userId: string,
  bggUsername: string,
  limit = 5
): Promise<string[]> {
  const username = bggUsername.toLowerCase().trim();

  const marked = await prisma.collectionEntry.findMany({
    where: { userId, OR: [{ showcased: true }, { keepScore: { gte: 4 } }] },
    select: { bggId: true, showcased: true, keepScore: true },
  });

  // Vitrina primero, luego 5, luego 4. El desempate por bggId es para que
  // la tarjeta salga siempre igual y las cachés no bailen.
  const weight = (e: (typeof marked)[number]) =>
    e.showcased ? 0 : e.keepScore === 5 ? 1 : 2;
  const preferredIds = [...marked]
    .sort((a, b) => weight(a) - weight(b) || a.bggId - b.bggId)
    .map((e) => e.bggId);

  const covers: string[] = [];
  const used = new Set<number>();

  if (preferredIds.length > 0) {
    const rows = await prisma.collectionGame.findMany({
      where: {
        bggUsername: username,
        status: "own",
        bggId: { in: preferredIds },
        image: { not: null },
      },
      select: { bggId: true, image: true },
    });
    const imageById = new Map(rows.map((r) => [r.bggId, r.image!]));
    for (const bggId of preferredIds) {
      if (covers.length >= limit) break;
      const image = imageById.get(bggId);
      if (!image || used.has(bggId)) continue;
      used.add(bggId);
      covers.push(image);
    }
  }

  if (covers.length < limit) {
    const rows = await prisma.collectionGame.findMany({
      where: {
        bggUsername: username,
        status: "own",
        subtype: "boardgame",
        image: { not: null },
        ...(used.size > 0 ? { bggId: { notIn: [...used] } } : {}),
      },
      select: { image: true },
      orderBy: { bggRank: { sort: "asc", nulls: "last" } },
      take: limit - covers.length,
    });
    for (const row of rows) if (row.image) covers.push(row.image);
  }

  return covers;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * La frase de la descripción del enlace, donde no se ve nada más: lleva el
 * nombre y las dos cifras.
 */
export function collectionTagline(opts: {
  name: string;
  games: number;
  expansions: number;
}): string {
  if (opts.games === 0) return `La estantería de ${opts.name} en BG Planner.`;
  const expansiones =
    opts.expansions > 0
      ? ` y ${plural(opts.expansions, "expansión", "expansiones")}`
      : "";
  return `${plural(opts.games, "juego", "juegos")}${expansiones} en la estantería de ${opts.name}, con sus partidas y sus notas.`;
}

/**
 * La frase de la tarjeta. Ahí el nombre y el número de juegos ya se leen en
 * grande, así que repetirlos gastaba dos líneas de las pocas que caben.
 */
export function collectionCardTagline(expansions: number): string {
  return expansions > 0
    ? `Con ${plural(expansions, "expansión", "expansiones")}, sus partidas y sus notas.`
    : "Con sus partidas y sus notas, en BG Planner.";
}

/** Cuántos juegos y cuántas expansiones tiene, para el texto de la tarjeta. */
export async function countOwnedGames(bggUsername: string) {
  const username = bggUsername.toLowerCase().trim();
  const [games, expansions] = await Promise.all([
    prisma.collectionGame.count({
      where: { bggUsername: username, status: "own", subtype: "boardgame" },
    }),
    prisma.collectionGame.count({
      where: { bggUsername: username, status: "own", subtype: "boardgameexpansion" },
    }),
  ]);
  return { games, expansions };
}
