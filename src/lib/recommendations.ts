import { prisma } from "@/lib/prisma";
import {
  fetchBggGameDetails,
  fetchBggHotIds,
  fetchBggUserGames,
} from "@/lib/bgg";
import {
  categoryLabel,
  mechanicLabel,
  type RecommendationsResponse,
  type RecommendationsStatus,
  type RecommendedGame,
  type TasteAnchor,
} from "@/lib/recommendationTypes";

// Recomendaciones "si te gustó X te gustará Y".
//
// Es un recomendador por contenido: cada juego es un vector de lo que lo
// define en BGG (autores, mecánicas, categorías y familias, pesados con IDF
// para que "Gestión de la mano" no cuente lo mismo que un autor concreto) y
// lo que te recomendamos es lo que más se parece a lo que te gusta, corregido
// por lo bien valorado que está y por si a la gente de BG Planner que comparte
// tus favoritos también le encanta.
//
// Qué te gusta sale de tus notas de BGG, tu puntuación de permanencia, la
// vitrina, las partidas, tus votos en los grupos y tus crónicas. Y nunca te
// recomendamos nada que ya conozcas: ni lo que tienes, ni lo que tuviste, ni
// lo que has jugado o puntuado, ni lo que ya quieres o has descartado.

// ── Ajustes ─────────────────────────────────────────────────────────────

/** Cada cuánto se vuelve a pedir a BGG lo que has jugado y puntuado. */
const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000; // una semana
/** Cada cuánto se vuelve a pedir a BGG la ficha de un juego. */
export const INFO_TTL = 60 * 24 * 60 * 60 * 1000; // 60 días
/** Juegos tuyos que usamos, como mucho, para conocer tus gustos. */
const TASTE_LIMIT = 150;
/** Candidatos: los que estén por encima de este puesto en BGG. */
const POOL_MAX_RANK = 5000;
/** Lo mínimo para recomendar algo: que lo conozca gente y que guste. */
const MIN_USERS_RATED = 150;
const MIN_RATING = 6.3;
/** Juegos que pedimos a BGG en cada llamada (el máximo de `thing`). */
export const ENRICH_BATCH = 20;

const TOKEN_WEIGHTS = { d: 1.6, m: 1.0, c: 0.6, f: 0.8 } as const;

// Familias de BGG que no dicen nada de cómo es el juego: juntarían juegos
// por haber salido en Kickstarter o tener versión en Steam.
const NOISY_FAMILY_PREFIXES = [
  "Admin:",
  "Crowdfunding:",
  "Digital Implementations:",
  "Components:",
  "Players:",
  "Country:",
  "Region:",
  "Cities:",
  "Misc:",
  "Organizations:",
  "Contests:",
  "Tournaments:",
  "Versions & Editions:",
  "Language:",
  "Mechanism:", // ya van como mecánicas
];

// ── Pool de juegos con su vector ────────────────────────────────────────

interface PoolGame {
  bggId: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  subtype: string;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  weight: number | null;
  bggRating: number | null;
  bggRank: number | null;
  usersRated: number | null;
  designers: string[];
  families: string[];
  relatedIds: number[];
  /** token → peso, ya normalizado (norma 1). */
  vector: Map<string, number>;
}

interface Pool {
  games: Map<number, PoolGame>;
  loadedAt: number;
}

const POOL_TTL = 10 * 60 * 1000;
let poolCache: Pool | null = null;
let poolLoading: Promise<Pool> | null = null;

function tokensOf(g: {
  designers: string[];
  mechanics: string[];
  categories: string[];
  families: string[];
}): string[] {
  return [
    ...g.designers.map((d) => `d:${d}`),
    ...g.mechanics.map((m) => `m:${m}`),
    ...g.categories.map((c) => `c:${c}`),
    ...g.families
      .filter((f) => !NOISY_FAMILY_PREFIXES.some((p) => f.startsWith(p)))
      .map((f) => `f:${f}`),
  ];
}

async function loadPool(): Promise<Pool> {
  if (poolCache && Date.now() - poolCache.loadedAt < POOL_TTL) return poolCache;
  if (poolLoading) return poolLoading;

  poolLoading = (async () => {
    const rows = await prisma.bggGameInfo.findMany({
      where: { subtype: "boardgame" },
    });

    const tokenLists = rows.map((r) => [...new Set(tokensOf(r))]);
    const df = new Map<string, number>();
    for (const list of tokenLists) {
      for (const t of list) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const n = Math.max(rows.length, 1);

    const games = new Map<number, PoolGame>();
    rows.forEach((r, i) => {
      const vector = new Map<string, number>();
      let norm = 0;
      for (const t of tokenLists[i]) {
        const type = t[0] as keyof typeof TOKEN_WEIGHTS;
        const w = TOKEN_WEIGHTS[type] * Math.log(1 + n / (df.get(t) ?? 1));
        vector.set(t, w);
        norm += w * w;
      }
      norm = Math.sqrt(norm) || 1;
      for (const [t, w] of vector) vector.set(t, w / norm);

      games.set(r.bggId, {
        bggId: r.bggId,
        name: r.name,
        thumbnail: r.thumbnail,
        image: r.image,
        subtype: r.subtype,
        yearPublished: r.yearPublished,
        minPlayers: r.minPlayers,
        maxPlayers: r.maxPlayers,
        playingTime: r.playingTime,
        weight: r.weight,
        bggRating: r.bggRating,
        bggRank: r.bggRank,
        usersRated: r.usersRated,
        designers: r.designers,
        families: r.families,
        relatedIds: r.relatedIds,
        vector,
      });
    });

    poolCache = { games, loadedAt: Date.now() };
    return poolCache;
  })().finally(() => {
    poolLoading = null;
  });

  return poolLoading;
}

/** Parecido entre dos juegos: coseno de sus vectores, corregido por peso. */
function similarity(a: PoolGame, b: PoolGame): number {
  const [small, big] = a.vector.size < b.vector.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of small.vector) {
    const other = big.vector.get(t);
    if (other) dot += w * other;
  }
  if (dot === 0) return 0;
  // A quien le encanta un juego duro no le pega un party game aunque los
  // dos lleven "Dados": la diferencia de peso resta.
  if (a.weight && b.weight) {
    dot *= Math.max(0.45, 1 - 0.3 * Math.abs(a.weight - b.weight));
  }
  return dot;
}

/** Lo que comparten dos juegos, en castellano y de lo más a lo menos. */
function sharedTraits(a: PoolGame, b: PoolGame, max = 3): string[] {
  const shared: { t: string; w: number }[] = [];
  for (const [t, w] of a.vector) {
    const other = b.vector.get(t);
    if (other) shared.push({ t, w: w * other });
  }
  shared.sort((x, y) => y.w - x.w);

  // Un solo autor basta (y el principal, el primero que da BGG): "De Martin
  // Wallace, De Gavan Brown" se come el sitio de lo demás.
  const designer = b.designers.find((d) => a.vector.has(`d:${d}`));

  const labels: string[] = [];
  for (const { t } of shared) {
    const value = t.slice(2);
    let label: string | null = null;
    if (t.startsWith("d:")) label = value === designer ? `De ${value}` : null;
    else if (t.startsWith("m:")) label = mechanicLabel(value);
    else if (t.startsWith("c:")) label = categoryLabel(value);
    else if (t.startsWith("f:") && /^(Series|Game):/.test(value)) label = "De la misma saga";
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length >= max) break;
  }
  return labels;
}

function quality(g: PoolGame): number {
  const q = Math.min(1, Math.max(0, ((g.bggRating ?? 6) - 6.2) / 1.8));
  const pop = Math.min(1, Math.max(0, (Math.log10(g.usersRated ?? 1) - 2) / 2.5));
  return 0.5 + 0.35 * q + 0.15 * pop;
}

// ── Lo que te gusta ─────────────────────────────────────────────────────

interface TasteEntry {
  bggId: number;
  name: string;
  /** -1.2 (no lo soportas) … 1.4 (te encanta). */
  weight: number;
  why: string;
  /**
   * true si hay pruebas de que lo has jugado y te gusta (nota, permanencia,
   * vitrina, partidas, crónica). false si solo sabemos que te interesa
   * (votos, wishlist, tenerlo sin estrenar): un supervoto es "quiero
   * jugarlo", casi nunca "lo he jugado y me encanta".
   */
  liked: boolean;
}

interface UserSignals {
  taste: Map<number, TasteEntry>;
  /** Todo lo que ya conoces o has decidido: nunca se recomienda. */
  known: Set<number>;
}

const KEEP_WEIGHT: Record<number, number> = { 5: 1.0, 4: 0.6, 3: 0.15, 2: -0.3, 1: -0.6 };
const KEEP_WHY: Record<number, string> = {
  5: "No se irá nunca de tu estantería",
  4: "Se queda en tu estantería",
};
const REVIEW_WEIGHT: Record<number, number> = { 5: 0.9, 4: 0.5, 3: 0, 2: -0.4, 1: -0.8 };

function fmtRating(r: number): string {
  return r % 1 === 0 ? String(r) : r.toFixed(1).replace(".", ",");
}

async function loadUserSignals(userId: string, bggUsername: string): Promise<UserSignals> {
  const username = bggUsername.toLowerCase().trim();
  const [collection, history, entries, votes, reviews, flags] = await Promise.all([
    prisma.collectionGame.findMany({
      where: { bggUsername: username },
      select: {
        bggId: true,
        name: true,
        subtype: true,
        status: true,
        numPlays: true,
        userRating: true,
      },
    }),
    prisma.bggUserGame.findMany({ where: { bggUsername: username } }),
    prisma.collectionEntry.findMany({
      where: { userId },
      select: { bggId: true, keepScore: true, showcased: true },
    }),
    prisma.vote.findMany({
      where: { userId },
      select: { value: true, groupGame: { select: { game: { select: { bggId: true, name: true } } } } },
    }),
    prisma.gameReview.findMany({
      where: { userId },
      select: { rating: true, groupGame: { select: { game: { select: { bggId: true, name: true } } } } },
    }),
    prisma.userGameFlag.findMany({ where: { userId } }),
  ]);

  const known = new Set<number>();
  // Señales por juego, antes de combinarlas.
  // `tried`: la señal viene de haberlo jugado, no de tener ganas de jugarlo.
  type Signal = { w: number; why: string; tried: boolean };
  type Raw = {
    name: string;
    explicit: Signal[];
    implicit: Signal[];
    showcased: boolean;
  };
  const raw = new Map<number, Raw>();
  const get = (bggId: number, name: string): Raw => {
    let r = raw.get(bggId);
    if (!r) {
      r = { name, explicit: [], implicit: [], showcased: false };
      raw.set(bggId, r);
    }
    return r;
  };

  const ratingSignal = (r: number): Signal => ({
    w: Math.max(-1.2, Math.min(1.4, (r - 6.5) / 2.5)),
    why: `Le diste un ${fmtRating(r)} en BGG`,
    tried: true,
  });
  const playsSignal = (plays: number): Signal => ({
    w: plays >= 10 ? 0.8 : plays >= 5 ? 0.6 : plays >= 2 ? 0.4 : 0.15,
    why: plays >= 2 ? `Lo has jugado ${plays} veces` : "Lo has jugado",
    tried: true,
  });

  const ratedIds = new Set<number>();
  for (const row of collection) {
    known.add(row.bggId);
    if (row.subtype !== "boardgame") continue;
    const r = get(row.bggId, row.name);
    if (row.userRating !== null) {
      r.explicit.push(ratingSignal(row.userRating));
      ratedIds.add(row.bggId);
    }
    if (row.status === "wishlist") {
      r.implicit.push({ w: 0.35, why: "Está en tu wishlist", tried: false });
    } else if (row.numPlays > 0) {
      r.implicit.push(playsSignal(row.numPlays));
    } else {
      r.implicit.push({ w: 0.2, why: "Lo tienes sin estrenar", tried: false });
    }
  }

  for (const row of history) {
    known.add(row.bggId);
    const r = get(row.bggId, row.name);
    if (row.userRating !== null && !ratedIds.has(row.bggId)) {
      r.explicit.push(ratingSignal(row.userRating));
    }
    if (row.numPlays > 0) r.implicit.push(playsSignal(row.numPlays));
    else if (row.prevOwned) r.implicit.push({ w: -0.15, why: "Lo tuviste", tried: false });
  }

  for (const e of entries) {
    const r = raw.get(e.bggId);
    if (!r) continue; // puntuaciones de juegos que ya no están en la colección
    if (e.keepScore) {
      r.explicit.push({
        w: KEEP_WEIGHT[e.keepScore],
        why: KEEP_WHY[e.keepScore] ?? "Lo tienes puntuado",
        tried: true,
      });
    }
    if (e.showcased) r.showcased = true;
  }

  for (const v of votes) {
    const game = v.groupGame.game;
    known.add(game.bggId);
    const r = get(game.bggId, game.name);
    // Votar es "quiero jugarlo", no "me gusta": suele ser un juego que aún
    // no has probado. Cuenta como interés, y flojito.
    if (v.value >= 3) r.implicit.push({ w: 0.5, why: "Le diste tu supervoto", tried: false });
    else if (v.value > 0) r.implicit.push({ w: 0.3, why: "Lo votaste en tu grupo", tried: false });
    else if (v.value < 0) r.implicit.push({ w: -0.3, why: "Votaste en contra", tried: false });
  }

  for (const rev of reviews) {
    const game = rev.groupGame.game;
    known.add(game.bggId);
    if (!rev.rating) continue;
    get(game.bggId, game.name).explicit.push({
      w: REVIEW_WEIGHT[rev.rating] ?? 0,
      why: `Le pusiste ${rev.rating} ${rev.rating === 1 ? "estrella" : "estrellas"} en tu crónica`,
      tried: true,
    });
  }

  for (const f of flags) {
    known.add(f.bggId);
    const r = get(f.bggId, "");
    if (f.kind === "wishlist") r.implicit.push({ w: 0.35, why: "Está en tu wishlist", tried: false });
    else r.explicit.push({ w: -0.25, why: "Dijiste que no te interesa", tried: false });
  }

  // Lo explícito (notas, puntuaciones, crónicas) manda sobre lo implícito
  // (jugarlo, tenerlo, votarlo). La vitrina es un "me encanta" sin discusión.
  const taste = new Map<number, TasteEntry>();
  for (const [bggId, r] of raw) {
    let weight: number;
    if (r.explicit.length > 0) {
      weight = r.explicit.reduce((s, x) => s + x.w, 0) / r.explicit.length;
    } else if (r.implicit.length > 0) {
      weight = Math.max(...r.implicit.map((x) => x.w));
    } else {
      continue;
    }
    const all = [...r.explicit, ...r.implicit];
    const triedSignals = all.filter((x) => x.tried && x.w > 0);
    let liked = triedSignals.length > 0;
    // El porqué que se enseña: lo que demuestra que te gusta, si lo hay.
    let why = [...(liked ? triedSignals : all)].sort(
      (a, b) => Math.abs(b.w) - Math.abs(a.w)
    )[0].why;
    if (r.showcased && weight < 1.2) {
      weight = 1.2;
      why = "Está en tu vitrina";
      liked = true;
    }
    taste.set(bggId, { bggId, name: r.name, weight, why, liked });
  }

  return { taste, known };
}

/** Los juegos que más dicen de tus gustos, en uno y otro sentido. */
function strongestTaste(taste: Map<number, TasteEntry>): TasteEntry[] {
  return [...taste.values()]
    .filter((t) => Math.abs(t.weight) >= 0.2)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, TASTE_LIMIT);
}

// ── Lo que le gusta a la comunidad ──────────────────────────────────────

const COMMUNITY_TTL = 30 * 60 * 1000;
let communityCache: { likes: Map<string, Set<number>>; loadedAt: number } | null = null;

/** Por usuario de BGG, los juegos a los que ha puesto un 8 o más. */
async function loadCommunityLikes(): Promise<Map<string, Set<number>>> {
  if (communityCache && Date.now() - communityCache.loadedAt < COMMUNITY_TTL) {
    return communityCache.likes;
  }
  const [collection, history] = await Promise.all([
    prisma.collectionGame.findMany({
      where: { userRating: { gte: 8 }, subtype: "boardgame" },
      select: { bggUsername: true, bggId: true },
    }),
    prisma.bggUserGame.findMany({
      where: { userRating: { gte: 8 } },
      select: { bggUsername: true, bggId: true },
    }),
  ]);
  const likes = new Map<string, Set<number>>();
  for (const row of [...collection, ...history]) {
    let set = likes.get(row.bggUsername);
    if (!set) likes.set(row.bggUsername, (set = new Set()));
    set.add(row.bggId);
  }
  communityCache = { likes, loadedAt: Date.now() };
  return likes;
}

/**
 * Para cada candidato, el favorito tuyo con el que más se "co-adora" entre
 * la gente de BG Planner: cuántos lo adoran a la vez y cuánto pesa (lift).
 * Hace falta al menos dos personas para que cuente.
 */
function communityAffinity(
  me: string,
  likes: Map<string, Set<number>>,
  anchors: TasteEntry[],
  candidates: Set<number>
): Map<number, { anchor: number; common: number; score: number }> {
  const anchorIds = new Set(anchors.map((a) => a.bggId));
  const anchorWeight = new Map(anchors.map((a) => [a.bggId, a.weight]));
  const fans = new Map<number, number>();
  const pairs = new Map<number, Map<number, number>>();

  for (const [username, set] of likes) {
    if (username === me) continue;
    const myAnchors: number[] = [];
    const theirPicks: number[] = [];
    for (const id of set) {
      fans.set(id, (fans.get(id) ?? 0) + 1);
      if (anchorIds.has(id)) myAnchors.push(id);
      if (candidates.has(id)) theirPicks.push(id);
    }
    if (myAnchors.length === 0) continue;
    for (const c of theirPicks) {
      let m = pairs.get(c);
      if (!m) pairs.set(c, (m = new Map()));
      for (const a of myAnchors) m.set(a, (m.get(a) ?? 0) + 1);
    }
  }

  const result = new Map<number, { anchor: number; common: number; score: number }>();
  for (const [c, m] of pairs) {
    let best: { anchor: number; common: number; score: number } | null = null;
    for (const [a, common] of m) {
      if (common < 2) continue;
      const lift = common / Math.sqrt((fans.get(a) ?? 1) * (fans.get(c) ?? 1));
      const score = (anchorWeight.get(a) ?? 0) * lift;
      if (!best || score > best.score) best = { anchor: a, common, score };
    }
    if (best) result.set(c, best);
  }
  return result;
}

// ── Recomendar ──────────────────────────────────────────────────────────

function toView(
  g: PoolGame,
  because: PoolGame | null,
  communityFans: number,
  liked: boolean
): RecommendedGame {
  return {
    bggId: g.bggId,
    name: g.name,
    thumbnail: g.thumbnail,
    image: g.image,
    yearPublished: g.yearPublished,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    playingTime: g.playingTime,
    weight: g.weight,
    bggRating: g.bggRating,
    bggRank: g.bggRank,
    because: because ? { bggId: because.bggId, name: because.name, liked } : null,
    traits: because ? sharedTraits(because, g) : [],
    communityFans,
  };
}

export async function getRecommendations(
  userId: string,
  bggUsername: string
): Promise<RecommendationsResponse> {
  const signals = await loadUserSignals(userId, bggUsername);
  const [pool, likes, status] = await Promise.all([
    loadPool(),
    loadCommunityLikes(),
    getPrepStatus(userId, bggUsername, signals),
  ]);

  const strongest = strongestTaste(signals.taste).filter((t) => pool.games.has(t.bggId));
  const liked = strongest.filter((t) => t.weight > 0.25).slice(0, 60);
  const disliked = strongest.filter((t) => t.weight < -0.2).slice(0, 30);

  const empty: RecommendationsResponse = {
    connected: true,
    forYou: [],
    becauseYouLiked: [],
    status,
  };
  if (liked.length === 0) return empty;

  // Otras versiones de lo que ya conoces (Agricola → Agricola revisado,
  // Nemesis: Retaliation → Nemesis) no son un descubrimiento. Se mira a dos
  // saltos para pillar a los "hermanos": GWT Argentina y GWT Nueva Zelanda
  // no se enlazan entre sí, sino los dos con el Great Western Trail original.
  // Y por los dos lados, porque BGG no siempre lo apunta en ambas fichas.
  const relatedOf = async (ids: Iterable<number>) => {
    const list = [...ids];
    if (list.length === 0) return new Set<number>();
    const rows = await prisma.bggGameInfo.findMany({
      where: { bggId: { in: list } },
      select: { relatedIds: true },
    });
    return new Set(rows.flatMap((r) => r.relatedIds));
  };
  const firstHop = await relatedOf(signals.known);
  const secondHop = await relatedOf(firstHop);
  const isRelatedToKnown = (g: PoolGame) =>
    firstHop.has(g.bggId) ||
    secondHop.has(g.bggId) ||
    g.relatedIds.some((id) => signals.known.has(id) || firstHop.has(id));

  const currentYear = new Date().getFullYear();
  const candidates: PoolGame[] = [];
  for (const g of pool.games.values()) {
    if (signals.known.has(g.bggId)) continue;
    if (isRelatedToKnown(g)) continue;
    if ((g.usersRated ?? 0) < MIN_USERS_RATED) continue;
    if ((g.bggRating ?? 0) < MIN_RATING) continue;
    if (g.yearPublished && g.yearPublished > currentYear) continue;
    if (g.vector.size === 0) continue;
    candidates.push(g);
  }

  const community = communityAffinity(
    bggUsername.toLowerCase().trim(),
    likes,
    liked.slice(0, 40),
    new Set(candidates.map((c) => c.bggId))
  );

  const likedGames = liked.map((t) => ({ t, g: pool.games.get(t.bggId)! }));
  const dislikedGames = disliked.map((t) => ({ t, g: pool.games.get(t.bggId)! }));

  interface Scored {
    g: PoolGame;
    score: number;
    anchor: PoolGame;
    /** Parecido con cada favorito, para las filas "si te gustó X". */
    sims: Map<number, number>;
    communityFans: number;
  }
  const scored: Scored[] = [];

  for (const c of candidates) {
    const contributions: { g: PoolGame; v: number }[] = [];
    const sims = new Map<number, number>();
    for (const { t, g } of likedGames) {
      const s = similarity(g, c);
      if (s <= 0) continue;
      sims.set(g.bggId, s);
      contributions.push({ g, v: t.weight * s });
    }
    if (contributions.length === 0) continue;
    contributions.sort((a, b) => b.v - a.v);

    // Los tres favoritos más cercanos, con rendimientos decrecientes: así
    // gana lo que se parece mucho a algo que adoras, no lo que se parece un
    // poco a todo.
    let content =
      contributions[0].v +
      0.5 * (contributions[1]?.v ?? 0) +
      0.25 * (contributions[2]?.v ?? 0);

    let penalty = 0;
    for (const { t, g } of dislikedGames) {
      penalty = Math.max(penalty, -t.weight * similarity(g, c));
    }
    content -= 0.7 * penalty;

    const comm = community.get(c.bggId);
    const score = content * quality(c) + (comm ? 0.6 * comm.score : 0);
    if (score <= 0.05) continue;

    // Si la comunidad lo explica mejor que el parecido, el "porque" es ese.
    const anchor =
      comm && comm.score * 0.6 > contributions[0].v * quality(c)
        ? (pool.games.get(comm.anchor) ?? contributions[0].g)
        : contributions[0].g;

    scored.push({
      g: c,
      score,
      anchor,
      sims,
      communityFans: comm && comm.anchor === anchor.bggId ? comm.common : 0,
    });
  }
  scored.sort((a, b) => b.score - a.score);

  // "Para ti": lo mejor, sin que un único favorito acapare la lista.
  const FOR_YOU = 36;
  const perAnchor = new Map<number, number>();
  const forYou: Scored[] = [];
  for (const s of scored) {
    if (forYou.length >= FOR_YOU) break;
    const used = perAnchor.get(s.anchor.bggId) ?? 0;
    if (used >= 3) continue;
    perAnchor.set(s.anchor.bggId, used + 1);
    forYou.push(s);
  }
  const shown = new Set(forYou.slice(0, 12).map((s) => s.g.bggId));

  // "Si te gustó X": tus favoritos con más y mejores parecidos, cada uno con
  // los suyos. No repetimos lo que ya sale arriba.
  const rows: { anchor: TasteAnchor; games: RecommendedGame[] }[] = [];
  for (const { t, g: anchorGame } of likedGames) {
    if (rows.length >= 4) break;
    // Solo de lo que has jugado y te gusta: "si te gustó X" de un juego al
    // que solo has dado tu supervoto sería mentira.
    if (t.weight < 0.5 || !t.liked) continue;
    const games = scored
      .filter((s) => !shown.has(s.g.bggId) && (s.sims.get(anchorGame.bggId) ?? 0) >= 0.22)
      .map((s) => ({ s, v: (s.sims.get(anchorGame.bggId) ?? 0) * quality(s.g) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
    if (games.length < 3) continue;
    for (const { s } of games) shown.add(s.g.bggId);
    rows.push({
      anchor: {
        bggId: anchorGame.bggId,
        name: anchorGame.name,
        thumbnail: anchorGame.thumbnail,
        image: anchorGame.image,
        why: t.why,
      },
      games: games.map(({ s }) => toView(s.g, anchorGame, 0, true)),
    });
  }

  return {
    connected: true,
    forYou: forYou.map((s) =>
      toView(s.g, s.anchor, s.communityFans, signals.taste.get(s.anchor.bggId)?.liked ?? false)
    ),
    becauseYouLiked: rows,
    status,
  };
}

// ── Preparar los datos ──────────────────────────────────────────────────
// Para recomendar hace falta saber de qué va cada juego, y eso hay que
// pedírselo a BGG de 20 en 20. La página lo va haciendo por pasos mientras
// enseña una barra de avance, y un cron diario completa el resto del pool.

/** Pide a BGG las fichas de estos juegos y las guarda. */
export async function saveGameInfo(bggIds: number[]): Promise<number> {
  const ids = [...new Set(bggIds)].slice(0, ENRICH_BATCH);
  if (ids.length === 0) return 0;
  const details = await fetchBggGameDetails(ids);
  const now = new Date();

  const answered = new Set(details.map((d) => d.bggId));
  await prisma.$transaction([
    ...details.map((d) => {
      const data = {
        name: d.name,
        thumbnail: d.thumbnail,
        image: d.image,
        subtype: d.subtype,
        yearPublished: d.yearPublished,
        minPlayers: d.minPlayers,
        maxPlayers: d.maxPlayers,
        playingTime: d.playingTime,
        bggRating: d.bggRating,
        bggRank: d.bggRank,
        usersRated: d.usersRated,
        weight: d.weight,
        mechanics: d.mechanics,
        categories: d.categories,
        designers: d.designers,
        families: d.families,
        relatedIds: d.relatedIds,
        fetchedAt: now,
      };
      return prisma.bggGameInfo.upsert({
        where: { bggId: d.bggId },
        update: data,
        create: { bggId: d.bggId, ...data },
      });
    }),
    // Los que BGG no conoce (borrados, ids rotos) se apuntan igualmente para
    // no volver a preguntar por ellos en cada pasada.
    ...ids
      .filter((id) => !answered.has(id))
      .map((id) =>
        prisma.bggGameInfo.upsert({
          where: { bggId: id },
          update: { fetchedAt: now },
          create: { bggId: id, name: "?", subtype: "missing", fetchedAt: now },
        })
      ),
  ]);

  poolCache = null;
  return details.length;
}

/** Trae de BGG lo que has jugado, puntuado o tenido, y lo guarda. */
export async function syncUserHistory(bggUsername: string): Promise<number> {
  const username = bggUsername.toLowerCase().trim();
  const items = await fetchBggUserGames(username);
  const now = new Date();
  await prisma.$transaction([
    prisma.bggUserGame.deleteMany({ where: { bggUsername: username } }),
    prisma.bggUserGame.createMany({
      data: items.map((i) => ({ bggUsername: username, ...i, fetchedAt: now })),
      skipDuplicates: true,
    }),
  ]);
  communityCache = null;
  return items.length;
}

async function historyFetchedAt(bggUsername: string): Promise<Date | null> {
  const latest = await prisma.bggUserGame.findFirst({
    where: { bggUsername: bggUsername.toLowerCase().trim() },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });
  return latest?.fetchedAt ?? null;
}

// Si alguien no tiene nada en BGG más allá de su colección, la tabla de
// historial se queda vacía y no hay fecha que mirar. Para no volver a pedirlo
// en cada visita, recordamos aquí (por instancia) a quién ya se lo pedimos.
const emptyHistoryAt = new Map<string, number>();

async function tasteMissingIds(signals: UserSignals): Promise<number[]> {
  const ids = strongestTaste(signals.taste).map((t) => t.bggId);
  if (ids.length === 0) return [];
  const fresh = { gte: new Date(Date.now() - INFO_TTL) };
  // Las fichas caducadas cuentan como pendientes: así tus juegos se
  // refrescan al entrar, sin esperar a que les toque en el cron.
  const have = await prisma.bggGameInfo.findMany({
    where: { bggId: { in: ids }, fetchedAt: fresh },
    select: { bggId: true },
  });
  const haveSet = new Set(have.map((h) => h.bggId));
  const missing = ids.filter((id) => !haveSet.has(id));

  // Y también las de las otras versiones de lo que ya conoces (el GWT
  // original de tu GWT Nueva Zelanda): son el puente para descartar a los
  // "hermanos" (GWT Argentina) sin esperar al cron.
  const knownRows = await prisma.bggGameInfo.findMany({
    where: { bggId: { in: [...signals.known] }, fetchedAt: fresh },
    select: { relatedIds: true },
  });
  const related = [...new Set(knownRows.flatMap((r) => r.relatedIds))].filter(
    (id) => !signals.known.has(id)
  );
  if (related.length === 0) return missing;
  const haveRelated = await prisma.bggGameInfo.findMany({
    where: { bggId: { in: related }, fetchedAt: fresh },
    select: { bggId: true },
  });
  const haveRelatedSet = new Set(haveRelated.map((h) => h.bggId));
  return [...missing, ...related.filter((id) => !haveRelatedSet.has(id))];
}

function isHistoryStale(username: string, fetchedAt: Date | null): boolean {
  const askedAt = fetchedAt?.getTime() ?? emptyHistoryAt.get(username);
  return !askedAt || Date.now() - askedAt >= HISTORY_TTL;
}

/**
 * Candidatos que aún no hemos estudiado, de más a menos prometedores: los
 * mejor colocados en BGG que tenga o quiera alguien de BG Planner, los de
 * los grupos y eventos, y los favoritos de la comunidad.
 */
export async function poolMissingIds(limit = 1000): Promise<number[]> {
  const [fromCollections, fromGames, fromFavourites, have] = await Promise.all([
    prisma.collectionGame.groupBy({
      by: ["bggId"],
      where: { subtype: "boardgame", bggRank: { lte: POOL_MAX_RANK } },
      _min: { bggRank: true },
    }),
    prisma.game.findMany({
      where: { bggRank: { lte: POOL_MAX_RANK } },
      select: { bggId: true, bggRank: true },
    }),
    prisma.bggUserGame.findMany({
      where: { userRating: { gte: 8 } },
      select: { bggId: true },
      distinct: ["bggId"],
    }),
    prisma.bggGameInfo.findMany({ select: { bggId: true } }),
  ]);

  const haveSet = new Set(have.map((h) => h.bggId));
  const rank = new Map<number, number>();
  for (const row of fromCollections) rank.set(row.bggId, row._min.bggRank ?? 99999);
  for (const row of fromGames) {
    rank.set(row.bggId, Math.min(rank.get(row.bggId) ?? 99999, row.bggRank ?? 99999));
  }
  for (const row of fromFavourites) {
    if (!rank.has(row.bggId)) rank.set(row.bggId, 99999);
  }

  return [...rank.entries()]
    .filter(([id]) => !haveSet.has(id))
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([id]) => id);
}

/** Fichas que llevan tiempo sin refrescarse (rank y notas cambian). */
export async function staleInfoIds(limit = ENRICH_BATCH): Promise<number[]> {
  const rows = await prisma.bggGameInfo.findMany({
    where: { fetchedAt: { lt: new Date(Date.now() - INFO_TTL) } },
    orderBy: { fetchedAt: "asc" },
    select: { bggId: true },
    take: limit,
  });
  return rows.map((r) => r.bggId);
}

/** Los más comentados en BGG ahora mismo que aún no tenemos. */
export async function hotMissingIds(): Promise<number[]> {
  const hot = await fetchBggHotIds();
  if (hot.length === 0) return [];
  const have = await prisma.bggGameInfo.findMany({
    where: { bggId: { in: hot } },
    select: { bggId: true },
  });
  const haveSet = new Set(have.map((h) => h.bggId));
  return hot.filter((id) => !haveSet.has(id));
}

export async function getPrepStatus(
  userId: string,
  bggUsername: string,
  signals?: UserSignals
): Promise<RecommendationsStatus> {
  const username = bggUsername.toLowerCase().trim();
  const userSignals = signals ?? (await loadUserSignals(userId, username));
  const [fetchedAt, tasteMissing, poolMissing, poolSize] = await Promise.all([
    historyFetchedAt(username),
    tasteMissingIds(userSignals),
    poolMissingIds(),
    prisma.bggGameInfo.count({ where: { subtype: "boardgame" } }),
  ]);
  const tasteCount = strongestTaste(userSignals.taste).length;
  return {
    historyFetchedAt: fetchedAt ? fetchedAt.toISOString() : null,
    historyStale: isHistoryStale(username, fetchedAt),
    tasteMissing: tasteMissing.length,
    poolMissing: poolMissing.length,
    tasteCount: Math.max(0, tasteCount - tasteMissing.length),
    poolSize,
  };
}

/**
 * Un paso de preparación, lo más corto posible (una o dos llamadas a BGG):
 * primero lo que has jugado y puntuado (como mucho una vez por semana) y
 * luego de qué van tus juegos nuevos. Ampliar el pool de candidatos no se
 * hace aquí sino en el cron: así entrar en la página no le cuesta a BGG más
 * que lo imprescindible. Devuelve qué ha hecho.
 */
export async function prepareStep(
  userId: string,
  bggUsername: string
): Promise<"history" | "taste" | "done"> {
  const username = bggUsername.toLowerCase().trim();

  if (isHistoryStale(username, await historyFetchedAt(username))) {
    const count = await syncUserHistory(username);
    if (count === 0) emptyHistoryAt.set(username, Date.now());
    return "history";
  }

  const tasteMissing = await tasteMissingIds(await loadUserSignals(userId, username));
  if (tasteMissing.length > 0) {
    await saveGameInfo(tasteMissing.slice(0, ENRICH_BATCH));
    return "taste";
  }

  return "done";
}
