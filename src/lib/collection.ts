// Tipos y lógica de "Mi colección" SIN dependencias de servidor: este módulo
// lo importa también el navegador, que es quien filtra y ordena. La carga
// desde la base de datos vive en collectionData.ts.

// ── Puntuación de permanencia ───────────────────────────────────────────
// Cuánto de seguro está el dueño de que el juego sigue en su estantería
// dentro de un año. No es "cómo de bueno es" (para eso está su nota de BGG),
// sino "cómo de a salvo está de la caja de ventas".

export const KEEP_SCORES = [1, 2, 3, 4, 5] as const;

export const KEEP_LABELS: Record<number, string> = {
  1: "Quiero venderlo",
  2: "Última oportunidad",
  3: "Pensando en ello",
  4: "Se queda",
  5: "No se irá nunca",
};

export const KEEP_EMOJI: Record<number, string> = {
  1: "💸",
  2: "⏳",
  3: "🤔",
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

// ── Tipos ───────────────────────────────────────────────────────────────

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

export interface CollectionFilters {
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

// ── Recuento ────────────────────────────────────────────────────────────

// Se calcula sobre la colección entera, no sobre lo filtrado, para que la
// cabecera no baile al filtrar. Al vivir en el navegador, los contadores se
// actualizan en cuanto puntúas, sin esperar al servidor.
export function computeStats(items: CollectionItemView[]): CollectionStats {
  const stats: CollectionStats = {
    total: items.length,
    owned: 0,
    wishlist: 0,
    rated: 0,
    unrated: 0,
    byScore: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    expansions: 0,
  };

  for (const item of items) {
    stats.expansions += item.expansions.length;
    if (item.status === "wishlist") {
      stats.wishlist++;
      continue;
    }
    stats.owned++;
    if (item.keepScore) {
      stats.rated++;
      stats.byScore[item.keepScore]++;
    } else {
      stats.unrated++;
    }
  }

  return stats;
}

// ── Filtro y orden ──────────────────────────────────────────────────────

export function filterItems(
  items: CollectionItemView[],
  f: CollectionFilters
): CollectionItemView[] {
  const search = f.search.trim().toLowerCase();

  return items.filter((item) => {
    if (f.status !== "all" && item.status !== f.status) return false;

    if (search) {
      const hit =
        item.name.toLowerCase().includes(search) ||
        item.expansions.some((e) => e.name.toLowerCase().includes(search));
      if (!hit) return false;
    }

    if (f.keep === "unrated" && item.keepScore !== null) return false;
    if (f.keep === "rated" && item.keepScore === null) return false;
    if (/^[1-5]$/.test(f.keep) && item.keepScore !== Number(f.keep)) return false;

    if (f.players !== undefined) {
      const min = item.minPlayers ?? 0;
      const max = item.maxPlayers ?? 99;
      if (f.players < min || f.players > max) return false;
    }

    if (f.unplayed) {
      if (item.numPlays + item.expansionPlays > 0) return false;
    } else if (f.minPlays !== undefined && item.numPlays < f.minPlays) {
      return false;
    }

    if (f.myRating === "yes" && item.userRating === null) return false;
    if (f.myRating === "no" && item.userRating !== null) return false;

    if (f.maxRank !== undefined && (item.bggRank === null || item.bggRank > f.maxRank))
      return false;
    if (f.minWeight !== undefined && (item.weight ?? 0) < f.minWeight) return false;
    if (f.maxWeight !== undefined && (item.weight ?? 99) > f.maxWeight) return false;

    if (f.showcased && !item.showcased) return false;

    return true;
  });
}

export function sortItems(
  items: CollectionItemView[],
  sort: CollectionSort,
  order: "asc" | "desc" | ""
): CollectionItemView[] {
  const sign = (order || DEFAULT_SORT_DIR[sort]) === "asc" ? 1 : -1;

  const pick = (i: CollectionItemView): number | string | null => {
    switch (sort) {
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

  // Los juegos sin dato (sin rank, sin nota, sin puntuar) van siempre al
  // final, se ordene como se ordene: son ruido, no el resultado buscado.
  return [...items].sort((a, b) => {
    const va = pick(a);
    const vb = pick(b);
    if (va === null && vb === null) return a.name.localeCompare(b.name);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return (va < vb ? -1 : 1) * sign;
    return a.name.localeCompare(b.name);
  });
}
