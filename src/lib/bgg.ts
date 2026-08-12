import { parseStringPromise } from "xml2js";
import { prisma } from "@/lib/prisma";

export type BggCollectionItem = {
  bggId: number;
  name: string;
  thumbnail: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  bggRating: number | null;
  bggRank: number | null;
  weight: number | null;
  numPlays: number;
  userRating: number | null;
  dateAdded: Date | null;
  subtype: string; // "boardgame" | "boardgameexpansion"
};

export type PlayerCountRec = {
  numPlayers: string;
  best: number;
  recommended: number;
  notRecommended: number;
  verdict: "Best" | "Recommended" | "Not Recommended";
};

export type BggGameDetails = {
  bggId: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  bggRating: number | null;
  bggRank: number | null;
  weight: number | null;
  playerCountRecommendations: PlayerCountRec[];
};

export type BggSearchResult = {
  bggId: number;
  name: string;
  yearPublished: number | null;
  thumbnail?: string | null;
};

// ── BGG Search cache (bounded to 200 entries) ──────────────────────────
const searchCache = new Map<string, { results: BggSearchResult[]; fetchedAt: number }>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SEARCH_CACHE_MAX = 200;

function searchCacheSet(key: string, results: BggSearchResult[]) {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    // Evict oldest entry
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, { results, fetchedAt: Date.now() });
}

// DB-backed collection cache — refreshes once per day or on demand
const COLLECTION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── BGG API Authentication ──────────────────────────────────────────────
// La XML API2 exige registro de aplicación + token de autorización (desde
// 2025-07). Nos autenticamos con un token Bearer obtenido en
// https://boardgamegeek.com/applications (pestaña "Tokens"). Configúralo en
// la variable de entorno BGG_API_TOKEN. Requisitos de la doc oficial:
//   - Dominio boardgamegeek.com SIN www (el www interfiere con la auth).
//   - Cabecera exacta: "Authorization: Bearer <token>" (espacio, sin ":").
//   - Los tokens no requieren refresco (de momento).
const BGG_USER_AGENT = "BGPlanner/1.0 (+https://bgplanner.app)";

// BGG limita el ritmo: si pides demasiado rápido responde 500/503 y sugiere
// ~5 s entre peticiones. Con app registrada el límite es más laxo, así que
// serializamos las llamadas con un espaciado educado.
const BGG_MIN_REQUEST_GAP_MS = 2000;
let bggLastRequestAt = 0;
let bggRequestChain: Promise<void> = Promise.resolve();

// Serializa las peticiones a BGG y garantiza un hueco mínimo entre ellas.
async function throttleBgg(): Promise<void> {
  const prev = bggRequestChain;
  let release!: () => void;
  bggRequestChain = new Promise<void>((r) => (release = r));
  await prev;
  const wait = BGG_MIN_REQUEST_GAP_MS - (Date.now() - bggLastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  bggLastRequestAt = Date.now();
  release();
}

function getBggApiToken(): string {
  const token = process.env.BGG_API_TOKEN;
  if (!token) {
    throw new Error(
      "Configura BGG_API_TOKEN en las variables de entorno para acceder a la API de BGG."
    );
  }
  return token;
}

// Petición base a BGG: throttle + cabeceras obligatorias (auth + User-Agent).
async function bggFetch(url: string): Promise<Response> {
  await throttleBgg();
  return fetch(url, {
    headers: {
      Accept: "application/xml",
      "User-Agent": BGG_USER_AGENT,
      Authorization: `Bearer ${getBggApiToken()}`,
    },
  });
}

// ── Fetch with retry (maneja 202 "processing" y 429/500/503 "too busy") ──

async function fetchWithRetry(
  url: string,
  maxRetries = 6
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`[BGG Fetch] Attempt ${attempt + 1}: ${url.substring(0, 80)}...`);
    const response = await bggFetch(url);
    console.log(`[BGG Fetch] Response: ${response.status}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "No se pudo autenticar con BGG. Verifica que BGG_API_TOKEN es válido y no ha caducado."
      );
    }

    // 202 = preparando datos; 429/500/503 = throttling/servidor ocupado.
    // En ambos casos reintentamos con backoff exponencial.
    if (
      response.status === 202 ||
      response.status === 429 ||
      response.status === 500 ||
      response.status === 503
    ) {
      const retryAfter = parseInt(response.headers.get("retry-after") || "", 10);
      const backoff = Math.min(3000 * Math.pow(1.5, attempt), 15000);
      const delay = !isNaN(retryAfter) ? Math.min(retryAfter * 1000, 30000) : backoff;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    return response;
  }
  throw new Error(
    "BGG está ocupado o procesando tu colección. Espera unos segundos e inténtalo de nuevo."
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Validates that a BGG username exists by making a lightweight API call.
 */
export async function validateBggUsername(
  username: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(normalizedUsername)}&own=1&subtype=boardgame&page=1`;
    const response = await bggFetch(url);

    // 202 = BGG is preparing data, which means the user exists
    if (response.status === 202 || response.ok) {
      return { valid: true };
    }
    // If we can't authenticate to BGG, don't block the user
    if (response.status === 401 || response.status === 403) {
      return { valid: true };
    }
    if (response.status === 404) {
      return {
        valid: false,
        error: `No se encontró el usuario "${username}" en BGG. Verifica que el nombre es correcto.`,
      };
    }
    return { valid: true }; // Assume valid for other errors (rate limit, etc.)
  } catch {
    return { valid: true }; // Don't block on network errors
  }
}

/**
 * Ensures the collection for a BGG username is cached in the DB.
 * Returns true if it was refreshed from BGG, false if cache was fresh.
 */
export async function ensureBggCollection(
  username: string,
  forceRefresh = false
): Promise<boolean> {
  const normalizedUsername = username.toLowerCase().trim();

  // Check if we have fresh data
  if (!forceRefresh) {
    const latest = await prisma.collectionGame.findFirst({
      where: { bggUsername: normalizedUsername },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    });
    if (latest && Date.now() - latest.fetchedAt.getTime() < COLLECTION_CACHE_TTL) {
      console.log(`[BGG Cache] HIT for ${normalizedUsername}`);
      return false;
    }
  }

  console.log(`[BGG Cache] ${forceRefresh ? "FORCE REFRESH" : "MISS"} for ${normalizedUsername}, fetching from BGG...`);

  // Fetch boardgames AND expansions in parallel (BGG defaults to boardgame only)
  const [bgResponse, expResponse] = await Promise.all([
    fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(normalizedUsername)}&own=1&stats=1&subtype=boardgame&excludesubtype=boardgameexpansion`
    ),
    fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(normalizedUsername)}&own=1&stats=1&subtype=boardgameexpansion`
    ),
  ]);

  if (!bgResponse.ok) {
    if (bgResponse.status === 404) {
      throw new Error(`No se encontró el usuario "${username}" en BGG.`);
    }
    throw new Error(`Error al obtener colección de BGG: ${bgResponse.status}`);
  }

  const [bgXml, expXml] = await Promise.all([
    bgResponse.text(),
    expResponse.ok ? expResponse.text() : Promise.resolve(null),
  ]);

  const bgParsed = await parseStringPromise(bgXml, { explicitArray: false });
  const expParsed = expXml
    ? await parseStringPromise(expXml, { explicitArray: false })
    : null;

  const bgItems = bgParsed.items?.item
    ? Array.isArray(bgParsed.items.item) ? bgParsed.items.item : [bgParsed.items.item]
    : [];
  const expItems = expParsed?.items?.item
    ? Array.isArray(expParsed.items.item) ? expParsed.items.item : [expParsed.items.item]
    : [];

  if (bgItems.length === 0 && expItems.length === 0) {
    // Empty collection — clear existing rows
    await prisma.collectionGame.deleteMany({ where: { bggUsername: normalizedUsername } });
    return true;
  }

  // Tag each item with its subtype before merging
  const allRawItems = [
    ...bgItems.map((item: any) => ({ ...item, _subtype: "boardgame" })),
    ...expItems.map((item: any) => ({ ...item, _subtype: "boardgameexpansion" })),
  ];

  // Deduplicate by bggId — prefer "boardgame" over "boardgameexpansion"
  const seenIds = new Set<number>();
  const uniqueRawItems = allRawItems.filter((item: any) => {
    const id = parseInt(item.$.objectid);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  const now = new Date();
  const games: BggCollectionItem[] = uniqueRawItems
    .map((item: any) => {
      const stats = item.stats;
      const rating = stats?.rating;
      const ranks = rating?.ranks?.rank;
      const rankArr = Array.isArray(ranks) ? ranks : ranks ? [ranks] : [];
      const mainRank = rankArr.find((r: any) => r.$?.name === "boardgame");

      return {
        bggId: parseInt(item.$.objectid),
        name: typeof item.name === "string" ? item.name : item.name?._,
        thumbnail: item.thumbnail || null,
        yearPublished: item.yearpublished ? parseInt(item.yearpublished) : null,
        minPlayers: stats ? parseInt(stats.$?.minplayers) : null,
        maxPlayers: stats ? parseInt(stats.$?.maxplayers) : null,
        playingTime: stats?.$?.playingtime ? parseInt(stats.$.playingtime) || null : null,
        bggRating: rating?.average ? parseFloat(rating.average.$?.value) || null : null,
        bggRank: mainRank ? parseInt(mainRank.$?.value) || null : null,
        weight: rating?.averageweight ? parseFloat(rating.averageweight.$?.value) || null : null,
        numPlays: item.numplays ? parseInt(item.numplays) : 0,
        userRating: rating ? parseFloat(rating.$?.value) || null : null,
        dateAdded: item.status?.$?.lastmodified ? new Date(item.status.$.lastmodified) : null,
        subtype: item._subtype || item.$.subtype || "boardgame",
      };
    });

  // Preserve bestWith from previous sync
  const existingBestWith = await prisma.collectionGame.findMany({
    where: { bggUsername: normalizedUsername, bestWith: { not: null } },
    select: { bggId: true, bestWith: true },
  });
  const bestWithMap = new Map(existingBestWith.map((g) => [g.bggId, g.bestWith]));

  // Bulk upsert: delete old + create new in a transaction
  await prisma.$transaction([
    prisma.collectionGame.deleteMany({ where: { bggUsername: normalizedUsername } }),
    prisma.collectionGame.createMany({
      data: games.map((g) => ({
        bggUsername: normalizedUsername,
        bggId: g.bggId,
        name: g.name,
        thumbnail: g.thumbnail,
        yearPublished: g.yearPublished,
        minPlayers: g.minPlayers,
        maxPlayers: g.maxPlayers,
        bggRating: g.bggRating,
        bggRank: g.bggRank,
        weight: g.weight,
        playingTime: g.playingTime,
        numPlays: g.numPlays,
        userRating: g.userRating,
        bestWith: bestWithMap.get(g.bggId) || null,
        subtype: g.subtype,
        dateAdded: g.dateAdded,
        fetchedAt: now,
      })),
    }),
  ]);

  console.log(`[BGG Cache] Saved ${games.length} games for ${normalizedUsername}`);
  return true;
}

/**
 * Enrich collection games that are missing bestWith data.
 * Fetches thing details from BGG in a single batch and updates DB.
 * Returns the enriched bggId→bestWith map.
 */
export async function enrichCollectionGames(
  bggIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (bggIds.length === 0) return result;

  try {
    const details = await fetchBggGameDetails(bggIds);

    for (const detail of details) {
      const recs = detail.playerCountRecommendations;
      if (!recs || recs.length === 0) continue;

      // Find "Best" player counts
      const bestCounts = recs
        .filter((r) => r.verdict === "Best")
        .map((r) => r.numPlayers)
        .filter((n) => !n.includes("+"))
        .map((n) => parseInt(n))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);

      if (bestCounts.length === 0) {
        // Fallback: find "Recommended" counts
        const recCounts = recs
          .filter((r) => r.verdict === "Recommended")
          .map((r) => r.numPlayers)
          .filter((n) => !n.includes("+"))
          .map((n) => parseInt(n))
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);
        if (recCounts.length > 0) {
          const bestWith = recCounts.length === 1
            ? String(recCounts[0])
            : `${recCounts[0]}-${recCounts[recCounts.length - 1]}`;
          result.set(detail.bggId, bestWith);
        }
      } else {
        const bestWith = bestCounts.length === 1
          ? String(bestCounts[0])
          : `${bestCounts[0]}-${bestCounts[bestCounts.length - 1]}`;
        result.set(detail.bggId, bestWith);
      }
    }

    // Bulk update DB
    if (result.size > 0) {
      await Promise.all(
        Array.from(result.entries()).map(([bggId, bestWith]) =>
          prisma.collectionGame.updateMany({
            where: { bggId },
            data: { bestWith },
          })
        )
      );
      console.log(`[BGG Enrich] Updated bestWith for ${result.size} games`);
    }
  } catch (err) {
    console.error("[BGG Enrich] Error:", err);
  }

  return result;
}

export async function fetchBggGameDetails(
  bggIds: number[]
): Promise<BggGameDetails[]> {
  if (bggIds.length === 0) return [];

  // La API 'thing' admite un máximo de 20 IDs por llamada. Troceamos.
  const CHUNK_SIZE = 20;
  const chunks: number[][] = [];
  for (let i = 0; i < bggIds.length; i += CHUNK_SIZE) {
    chunks.push(bggIds.slice(i, i + CHUNK_SIZE));
  }

  const items: any[] = [];
  for (const chunk of chunks) {
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(",")}&stats=1`;
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(`Error al obtener detalles de BGG: ${response.status}`);
    }

    const xml = await response.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    if (!parsed.items?.item) continue;

    const chunkItems = Array.isArray(parsed.items.item)
      ? parsed.items.item
      : [parsed.items.item];
    items.push(...chunkItems);
  }

  return items.map((item: any) => {
    const stats = item.statistics;
    const ratings = stats?.ratings;
    const ranks = ratings?.ranks?.rank;
    const rankArr = Array.isArray(ranks) ? ranks : ranks ? [ranks] : [];
    const mainRank = rankArr.find(
      (r: any) => r.$?.name === "boardgame"
    );

    // Parse player count recommendations
    const polls = item.poll;
    const pollArr = Array.isArray(polls) ? polls : polls ? [polls] : [];
    const numPlayersPoll = pollArr.find(
      (p: any) => p.$?.name === "suggested_numplayers"
    );

    const playerCountRecommendations: PlayerCountRec[] = [];
    if (numPlayersPoll) {
      const results = numPlayersPoll.results;
      const resultsArr = Array.isArray(results)
        ? results
        : results
          ? [results]
          : [];

      for (const result of resultsArr) {
        const numPlayers = result.$?.numplayers;
        if (!numPlayers) continue;

        const resultItems = result.result;
        const resultArr = Array.isArray(resultItems)
          ? resultItems
          : resultItems
            ? [resultItems]
            : [];

        let best = 0;
        let recommended = 0;
        let notRecommended = 0;

        for (const ri of resultArr) {
          const votes = parseInt(ri.$?.numvotes) || 0;
          if (ri.$?.value === "Best") best = votes;
          else if (ri.$?.value === "Recommended") recommended = votes;
          else if (ri.$?.value === "Not Recommended") notRecommended = votes;
        }

        let verdict: "Best" | "Recommended" | "Not Recommended";
        if (best >= recommended && best >= notRecommended) {
          verdict = "Best";
        } else if (recommended >= notRecommended) {
          verdict = "Recommended";
        } else {
          verdict = "Not Recommended";
        }

        playerCountRecommendations.push({
          numPlayers,
          best,
          recommended,
          notRecommended,
          verdict,
        });
      }
    }

    const names = item.name;
    const nameArr = Array.isArray(names) ? names : names ? [names] : [];
    const primaryName = nameArr.find(
      (n: any) => n.$?.type === "primary"
    );

    return {
      bggId: parseInt(item.$.id),
      name: primaryName ? primaryName.$?.value : "Unknown",
      thumbnail: item.thumbnail || null,
      image: item.image || null,
      yearPublished: item.yearpublished?.$
        ? parseInt(item.yearpublished.$.value) || null
        : null,
      minPlayers: item.minplayers?.$
        ? parseInt(item.minplayers.$.value) || null
        : null,
      maxPlayers: item.maxplayers?.$
        ? parseInt(item.maxplayers.$.value) || null
        : null,
      bggRating: ratings?.average
        ? parseFloat(ratings.average.$?.value) || null
        : null,
      bggRank: mainRank
        ? parseInt(mainRank.$?.value) || null
        : null,
      weight: ratings?.averageweight
        ? parseFloat(ratings.averageweight.$?.value) || null
        : null,
      playerCountRecommendations,
    };
  });
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function getRecommendationForPlayerCount(
  recommendations: PlayerCountRec[],
  numPlayers: number
): PlayerCountRec | null {
  return (
    recommendations.find((r) => r.numPlayers === String(numPlayers)) ?? null
  );
}

// ── BGG Search ──────────────────────────────────────────────────────────
// Usamos solo endpoints licenciados. Los términos de uso de BGG prohíben las
// APIs privadas (p.ej. api.geekdo.com), así que la búsqueda va contra la
// XML API2 oficial y, si no responde, caemos a nuestras tablas locales.
// Estrategias en orden:
// 1. XML API v2 oficial (con token Bearer)
// 2. Fallback a nuestras tablas locales Game + CollectionGame

const SEARCH_RESULT_LIMIT = 40;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// El endpoint oficial no ordena por relevancia (devuelve tipo A-Z), así que
// reordenamos: coincidencia exacta → empieza por → palabra que empieza por →
// contiene. Dentro de cada grupo: nombre más corto y más reciente primero.
function relevanceTier(name: string, q: string): number {
  const n = name.toLowerCase().trim();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (new RegExp(`\\b${escapeRegExp(q)}`).test(n)) return 2;
  return 3;
}

function rankSearchResults(
  results: BggSearchResult[],
  q: string
): BggSearchResult[] {
  return [...results]
    .sort((a, b) => {
      const ta = relevanceTier(a.name, q);
      const tb = relevanceTier(b.name, q);
      if (ta !== tb) return ta - tb;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      const ya = a.yearPublished ?? 0;
      const yb = b.yearPublished ?? 0;
      if (yb !== ya) return yb - ya;
      return a.name.localeCompare(b.name);
    })
    .slice(0, SEARCH_RESULT_LIMIT);
}

// Cuántos de los primeros resultados enriquecemos con imagen.
const SEARCH_THUMBNAIL_COUNT = 20;

// Trae thumbnails de BGG con una sola llamada `thing` (máx. 20 IDs, sin stats).
async function fetchBggThumbnails(bggIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (bggIds.length === 0) return map;

  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggIds.slice(0, 20).join(",")}`;
  const response = await fetchWithRetry(url);
  if (!response.ok) return map;

  const xml = await response.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  if (!parsed.items?.item) return map;

  const items = Array.isArray(parsed.items.item)
    ? parsed.items.item
    : [parsed.items.item];
  for (const item of items) {
    const id = parseInt(item.$.id, 10);
    if (item.thumbnail) map.set(id, item.thumbnail);
  }
  return map;
}

// Adjunta imagen a los primeros resultados SOLO desde nuestras tablas
// (rápido, sin tocar BGG). Las que falten se piden aparte (getBggThumbnails).
async function attachDbThumbnails(
  results: BggSearchResult[]
): Promise<BggSearchResult[]> {
  const ids = results.slice(0, SEARCH_THUMBNAIL_COUNT).map((r) => r.bggId);
  if (ids.length === 0) return results;

  const thumbById = new Map<number, string>();
  const [games, colGames] = await Promise.all([
    prisma.game.findMany({
      where: { bggId: { in: ids }, thumbnail: { not: null } },
      select: { bggId: true, thumbnail: true },
    }),
    prisma.collectionGame.findMany({
      where: { bggId: { in: ids }, thumbnail: { not: null } },
      select: { bggId: true, thumbnail: true },
    }),
  ]);
  for (const g of games) if (g.thumbnail) thumbById.set(g.bggId, g.thumbnail);
  for (const g of colGames)
    if (g.thumbnail && !thumbById.has(g.bggId)) thumbById.set(g.bggId, g.thumbnail);

  return results.map((r) => ({ ...r, thumbnail: thumbById.get(r.bggId) ?? null }));
}

// ── Caché en memoria de thumbnails (para no repetir llamadas a BGG) ──────
const thumbCache = new Map<number, { url: string | null; fetchedAt: number }>();
const THUMB_CACHE_TTL = 60 * 60 * 1000; // 1 hora
const THUMB_CACHE_MAX = 3000;

function thumbCacheSet(id: number, url: string | null) {
  if (thumbCache.size >= THUMB_CACHE_MAX) {
    const firstKey = thumbCache.keys().next().value;
    if (firstKey !== undefined) thumbCache.delete(firstKey);
  }
  thumbCache.set(id, { url, fetchedAt: Date.now() });
}

// Fase 2: resuelve thumbnails que faltan. Usa la caché en memoria y, para lo
// que no esté cacheado, una sola llamada a BGG. Cachea también los "sin
// imagen" para no volver a pedirlos. Devuelve solo los que tienen imagen.
export async function getBggThumbnails(
  bggIds: number[]
): Promise<Record<number, string>> {
  const result: Record<number, string> = {};
  const now = Date.now();
  const uncached: number[] = [];

  for (const id of bggIds.slice(0, 20)) {
    const cached = thumbCache.get(id);
    if (cached && now - cached.fetchedAt < THUMB_CACHE_TTL) {
      if (cached.url) result[id] = cached.url;
    } else {
      uncached.push(id);
    }
  }

  if (uncached.length > 0) {
    try {
      const fetched = await fetchBggThumbnails(uncached);
      for (const id of uncached) {
        const url = fetched.get(id) ?? null;
        thumbCacheSet(id, url);
        if (url) result[id] = url;
      }
    } catch (err) {
      console.log("[BGG Thumbnails] no disponibles:", err);
    }
  }

  return result;
}

export async function searchBggGames(query: string): Promise<BggSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  // Check cache
  const cached = searchCache.get(normalizedQuery);
  if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_TTL) {
    return cached.results;
  }

  let results: BggSearchResult[] = [];

  // Strategy 1: XML API v2 oficial (con token Bearer)
  try {
    const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(normalizedQuery)}&type=boardgame`;
    const response = await fetchWithRetry(url);
    if (response.ok) {
      const xml = await response.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = await parseStringPromise(xml);
      if (parsed.items?.item) {
        const rawItems = Array.isArray(parsed.items.item)
          ? parsed.items.item
          : [parsed.items.item];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results = rawItems.map((item: any) => ({
          bggId: parseInt(item.$.id, 10),
          name: item.name?.[0]?.$.value || "Unknown",
          yearPublished: item.yearpublished?.[0]?.$.value
            ? parseInt(item.yearpublished[0].$.value, 10)
            : null,
        }));
      }
    }
  } catch (err) {
    console.log("[BGG Search] XML API failed, using local DB...", err);
  }

  // Strategy 2: Search our local Game + CollectionGame tables
  if (results.length === 0) {
    const localGames = await prisma.game.findMany({
      where: { name: { contains: normalizedQuery, mode: "insensitive" } },
      select: { bggId: true, name: true, yearPublished: true },
      take: 20,
      orderBy: { bggRating: "desc" },
    });
    const collectionGames = await prisma.collectionGame.findMany({
      where: {
        name: { contains: normalizedQuery, mode: "insensitive" },
        bggId: { notIn: localGames.map((g) => g.bggId) },
      },
      select: { bggId: true, name: true, yearPublished: true },
      take: 20,
      orderBy: { bggRating: "desc" },
    });
    results = [...localGames, ...collectionGames].map((g) => ({
      bggId: g.bggId,
      name: g.name,
      yearPublished: g.yearPublished,
    }));
  }

  // Reordenar por relevancia (exacto/prefijo primero) y limitar.
  results = rankSearchResults(results, normalizedQuery);

  // Fase 1: imagen solo desde nuestra BD (rápido). El resto se pide aparte.
  results = await attachDbThumbnails(results);

  if (results.length > 0) {
    searchCacheSet(normalizedQuery, results);
  }

  return results;
}
