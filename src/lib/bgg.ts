import { parseStringPromise } from "xml2js";

export type BggCollectionItem = {
  bggId: number;
  name: string;
  thumbnail: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  bggRating: number | null;
  bggRank: number | null;
  weight: number | null;
  numPlays: number;
  userRating: number | null;
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

// Simple in-memory cache
const collectionCache = new Map<
  string,
  { data: BggCollectionItem[]; timestamp: number }
>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getBggHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/xml",
  };
  const token = process.env.BGG_API_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithRetry(
  url: string,
  maxRetries = 6
): Promise<Response> {
  const headers = getBggHeaders();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, { headers });

    if (response.status === 401) {
      throw new Error(
        "La API de BGG requiere un token de autorización. Configura BGG_API_TOKEN en las variables de entorno."
      );
    }

    if (response.status === 202) {
      // BGG is preparing the data, wait with exponential backoff
      const delay = Math.min(3000 * Math.pow(1.5, attempt), 15000);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    return response;
  }
  throw new Error(
    "BGG está procesando tu colección. Espera unos segundos e inténtalo de nuevo."
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Validates that a BGG username exists by making a lightweight API call.
 * Returns the normalized (lowercase) username if valid.
 */
export async function validateBggUsername(
  username: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(normalizedUsername)}&own=1&subtype=boardgame&page=1`;
    const headers = getBggHeaders();
    const response = await fetch(url, { headers });

    // 202 = BGG is preparing data, which means the user exists
    if (response.status === 202 || response.ok) {
      return { valid: true };
    }
    // 401 without token = missing API config, don't block the user
    if (response.status === 401 && !process.env.BGG_API_TOKEN) {
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

export async function fetchBggCollection(
  username: string
): Promise<BggCollectionItem[]> {
  // Normalize username to lowercase — BGG redirects but API2 can return 401 for wrong case
  const normalizedUsername = username.toLowerCase().trim();
  const cacheKey = normalizedUsername;
  const cached = collectionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(normalizedUsername)}&own=1&stats=1`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `No se encontró el usuario "${username}" en BGG. Verifica que el nombre de usuario es correcto.`
      );
    }
    throw new Error(`Error al obtener colección de BGG: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });

  if (!parsed.items?.item) {
    return [];
  }

  const items = Array.isArray(parsed.items.item)
    ? parsed.items.item
    : [parsed.items.item];

  const collection: BggCollectionItem[] = items
    .filter((item: any) => item.$.subtype === "boardgame")
    .map((item: any) => {
      const stats = item.stats;
      const rating = stats?.rating;
      const ranks = rating?.ranks?.rank;
      const rankArr = Array.isArray(ranks) ? ranks : ranks ? [ranks] : [];
      const mainRank = rankArr.find(
        (r: any) => r.$?.name === "boardgame"
      );

      return {
        bggId: parseInt(item.$.objectid),
        name: typeof item.name === "string" ? item.name : item.name?._,
        thumbnail: item.thumbnail || null,
        yearPublished: item.yearpublished
          ? parseInt(item.yearpublished)
          : null,
        minPlayers: stats ? parseInt(stats.$?.minplayers) : null,
        maxPlayers: stats ? parseInt(stats.$?.maxplayers) : null,
        bggRating: rating?.average
          ? parseFloat(rating.average.$?.value) || null
          : null,
        bggRank: mainRank
          ? parseInt(mainRank.$?.value) || null
          : null,
        weight: rating?.averageweight
          ? parseFloat(rating.averageweight.$?.value) || null
          : null,
        numPlays: item.numplays ? parseInt(item.numplays) : 0,
        userRating: rating
          ? parseFloat(rating.$?.value) || null
          : null,
      };
    });

  collectionCache.set(cacheKey, { data: collection, timestamp: Date.now() });
  return collection;
}

export async function fetchBggGameDetails(
  bggIds: number[]
): Promise<BggGameDetails[]> {
  if (bggIds.length === 0) return [];

  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggIds.join(",")}&stats=1`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Error al obtener detalles de BGG: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });

  if (!parsed.items?.item) return [];

  const items = Array.isArray(parsed.items.item)
    ? parsed.items.item
    : [parsed.items.item];

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
