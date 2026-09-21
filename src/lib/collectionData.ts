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
