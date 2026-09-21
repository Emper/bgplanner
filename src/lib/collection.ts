import { prisma } from "@/lib/prisma";
import type { CollectionGame } from "@prisma/client";

// ── Puntuación de permanencia ───────────────────────────────────────────
// Cuánto de seguro está el dueño de que el juego sigue en su estantería
// dentro de un año. No es "cómo de bueno es" (para eso está su nota de BGG),
// sino "cómo de a salvo está de la caja de ventas".

export const KEEP_SCORES = [1, 2, 3, 4, 5] as const;

export const KEEP_LABELS: Record<number, string> = {
  1: "Quiero venderlo",
  2: "En duda",
  3: "Ni sí ni no",
  4: "Se queda",
  5: "No se irá nunca",
};

export const KEEP_EMOJI: Record<number, string> = {
  1: "💸",
  2: "🤔",
  3: "😐",
  4: "🛡️",
  5: "💎",
};

// Rojo (se va) → verde (se queda). Clases fijas para que Tailwind las vea.
export const KEEP_CLASSES: Record<number, string> = {
  1: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/50",
  2: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/50",
  3: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/50",
  4: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/50",
  5: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/50",
};

// Color plano para puntos, cintas y el relleno del slider.
export const KEEP_HEX: Record<number, string> = {
  1: "#f43f5e",
  2: "#f97316",
  3: "#94a3b8",
  4: "#0ea5e9",
  5: "#10b981",
};

// ── Tipos de la respuesta ───────────────────────────────────────────────

export interface CollectionExpansionView {
  bggId: number;
  name: string;
  thumbnail: string | null;
  yearPublished: number | null;
  numPlays: number;
  userRating: number | null;
  status: string;
  /** Puntuación propia de la expansión; null si va con la del juego base. */
  ownKeepScore: number | null;
}

export interface CollectionItemView {
  bggId: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  weight: number | null;
  bggRating: number | null;
  bggRank: number | null;
  bestWith: string | null;
  numPlays: number;
  userRating: number | null;
  dateAdded: string | null;
  status: string;
  wishlistPriority: number | null;
  /** true si es una expansión cuyo juego base no está en la colección. */
  isExpansion: boolean;
  keepScore: number | null;
  note: string | null;
  showcased: boolean;
  expansions: CollectionExpansionView[];
  /** Partidas sumadas de sus expansiones (BGG las cuenta por separado). */
  expansionPlays: number;
}

export interface CollectionStats {
  total: number;
  owned: number;
  wishlist: number;
  rated: number;
  unrated: number;
  /** Cuántos juegos hay en cada puntuación de permanencia. */
  byScore: Record<number, number>;
  expansions: number;
}

export type CollectionSort =
  | "added"
  | "keep"
  | "myRating"
  | "rank"
  | "rating"
  | "plays"
  | "year"
  | "weight"
  | "name";

export interface CollectionQuery {
  status: "own" | "wishlist" | "all";
  search: string;
  /** Puntuación: "" (todas), "unrated", "rated" o "1".."5". */
  keep: string;
  /** Juegos que admiten exactamente esta cantidad de jugadores. */
  players?: number;
  minPlays?: number;
  unplayed: boolean;
  /** "" (indiferente), "yes" (tiene nota mía en BGG), "no". */
  myRating: string;
  maxRank?: number;
  minWeight?: number;
  maxWeight?: number;
  showcased: boolean;
  sort: CollectionSort;
  order: "asc" | "desc" | "";
  page: number;
  pageSize: number;
}

export const DEFAULT_SORT_DIR: Record<CollectionSort, "asc" | "desc"> = {
  added: "desc",
  keep: "desc",
  myRating: "desc",
  rank: "asc",
  rating: "desc",
  plays: "desc",
  year: "desc",
  weight: "asc",
  name: "asc",
};

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

// ── Carga y filtrado ────────────────────────────────────────────────────

/**
 * Trae la colección entera del usuario y la devuelve ya agrupada (cada juego
 * base con sus expansiones dentro), filtrada, ordenada y paginada.
 *
 * Se carga completa en memoria a propósito: una colección típica son unos
 * cientos de filas, y tanto el agrupado de expansiones como la puntuación
 * heredada y los filtros por puntuación necesitan cruzar dos tablas que no
 * tienen relación en Prisma (`CollectionGame` va por usuario de BGG y
 * `CollectionEntry` por usuario de BG Planner). Hacerlo aquí sale más barato
 * y mucho más simple que pelearlo a base de SQL.
 */
export async function loadCollection(
  userId: string,
  bggUsername: string,
  q: CollectionQuery
): Promise<{ items: CollectionItemView[]; total: number; stats: CollectionStats }> {
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
  const all = [...bases, ...orphanExpansions].map(toView);

  // ── Estadísticas: se calculan sobre todo lo que tiene el usuario, no
  // sobre el filtro activo, para que la cabecera no baile al filtrar.
  const stats: CollectionStats = {
    total: all.length,
    owned: all.filter((i) => i.status === "own").length,
    wishlist: all.filter((i) => i.status === "wishlist").length,
    rated: 0,
    unrated: 0,
    byScore: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    expansions: expansions.length,
  };
  for (const item of all) {
    if (item.status !== "own") continue;
    if (item.keepScore) {
      stats.rated++;
      stats.byScore[item.keepScore]++;
    } else {
      stats.unrated++;
    }
  }

  // ── Filtros ───────────────────────────────────────────────────────────
  const search = q.search.trim().toLowerCase();
  const filtered = all.filter((item) => {
    if (q.status !== "all" && item.status !== q.status) return false;

    if (search) {
      const hit =
        item.name.toLowerCase().includes(search) ||
        item.expansions.some((e) => e.name.toLowerCase().includes(search));
      if (!hit) return false;
    }

    if (q.keep === "unrated" && item.keepScore !== null) return false;
    if (q.keep === "rated" && item.keepScore === null) return false;
    if (/^[1-5]$/.test(q.keep) && item.keepScore !== Number(q.keep)) return false;

    if (q.players !== undefined) {
      const min = item.minPlayers ?? 0;
      const max = item.maxPlayers ?? 99;
      if (q.players < min || q.players > max) return false;
    }

    if (q.unplayed) {
      if (item.numPlays + item.expansionPlays > 0) return false;
    } else if (q.minPlays !== undefined && item.numPlays < q.minPlays) {
      return false;
    }

    if (q.myRating === "yes" && item.userRating === null) return false;
    if (q.myRating === "no" && item.userRating !== null) return false;

    if (q.maxRank !== undefined && (item.bggRank === null || item.bggRank > q.maxRank))
      return false;
    if (q.minWeight !== undefined && (item.weight ?? 0) < q.minWeight) return false;
    if (q.maxWeight !== undefined && (item.weight ?? 99) > q.maxWeight) return false;

    if (q.showcased && !item.showcased) return false;

    return true;
  });

  // ── Orden ─────────────────────────────────────────────────────────────
  const dir = q.order || DEFAULT_SORT_DIR[q.sort];
  const sign = dir === "asc" ? 1 : -1;

  // Los juegos sin dato (sin rank, sin nota, sin puntuar) van siempre al
  // final, se ordene como se ordene: son ruido, no el resultado buscado.
  const compare = (a: CollectionItemView, b: CollectionItemView): number => {
    const pick = (i: CollectionItemView): number | string | null => {
      switch (q.sort) {
        case "added":
          return i.dateAdded;
        case "keep":
          return i.keepScore;
        case "myRating":
          return i.userRating;
        case "rank":
          return i.bggRank;
        case "rating":
          return i.bggRating;
        case "plays":
          return i.numPlays + i.expansionPlays;
        case "year":
          return i.yearPublished;
        case "weight":
          return i.weight;
        case "name":
          return i.name.toLowerCase();
      }
    };

    const va = pick(a);
    const vb = pick(b);
    if (va === null && vb === null) return a.name.localeCompare(b.name);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "string" && typeof vb === "string") {
      const cmp = va.localeCompare(vb);
      return cmp !== 0 ? cmp * sign : 0;
    }
    if (va !== vb) return (va < vb ? -1 : 1) * sign;
    return a.name.localeCompare(b.name);
  };

  filtered.sort(compare);

  const start = (q.page - 1) * q.pageSize;
  return {
    items: filtered.slice(start, start + q.pageSize),
    total: filtered.length,
    stats,
  };
}
