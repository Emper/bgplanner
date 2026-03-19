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

// ── BGG Session Management ──────────────────────────────────────────────
// BGG now requires authentication for API access. We log in with a BGG
// account and use the session cookie for all subsequent requests.
// This avoids needing a registered application + Bearer token.

let bggSessionCookie: string | null = null;
let bggSessionExpiry = 0;
const BGG_SESSION_TTL = 50 * 60 * 1000; // Refresh session every 50 min (BGG sets 1h expiry)

async function loginToBgg(): Promise<string> {
  const username = process.env.BGG_USERNAME;
  const password = process.env.BGG_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Configura BGG_USERNAME y BGG_PASSWORD en las variables de entorno para acceder a la API de BGG."
    );
  }

  const response = await fetch("https://boardgamegeek.com/login/api/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credentials: { username, password },
    }),
    redirect: "manual", // Don't follow redirects, we just need the cookie
  });

  // BGG returns 200 or 302 on success, 400/401 on failure
  if (response.status >= 400) {
    const body = await response.text();
    let errorMsg = "Error al iniciar sesión en BGG.";
    try {
      const parsed = JSON.parse(body);
      if (parsed.errors?.message) errorMsg = parsed.errors.message;
    } catch {
      // ignore parse error
    }
    throw new Error(`Login BGG fallido: ${errorMsg}`);
  }

  // Extract SessionID cookie from Set-Cookie headers
  const setCookies = response.headers.getSetCookie?.() || [];
  let sessionId = "";
  for (const cookie of setCookies) {
    const match = cookie.match(/SessionID=([^;]+)/);
    if (match) {
      sessionId = match[1];
      break;
    }
  }

  // Fallback: try raw header
  if (!sessionId) {
    const rawCookie = response.headers.get("set-cookie") || "";
    const match = rawCookie.match(/SessionID=([^;]+)/);
    if (match) {
      sessionId = match[1];
    }
  }

  if (!sessionId) {
    throw new Error(
      "No se pudo obtener la cookie de sesión de BGG. Verifica las credenciales."
    );
  }

  return sessionId;
}

async function getBggSessionCookie(): Promise<string> {
  // Also support Bearer token as alternative
  const token = process.env.BGG_API_TOKEN;
  if (token) {
    return `__bearer__${token}`;
  }

  if (bggSessionCookie && Date.now() < bggSessionExpiry) {
    return bggSessionCookie;
  }

  const sessionId = await loginToBgg();
  bggSessionCookie = sessionId;
  bggSessionExpiry = Date.now() + BGG_SESSION_TTL;
  return sessionId;
}

async function getBggFetchOptions(): Promise<RequestInit> {
  const session = await getBggSessionCookie();

  // If using Bearer token
  if (session.startsWith("__bearer__")) {
    return {
      headers: {
        Accept: "application/xml",
        Authorization: `Bearer ${session.slice("__bearer__".length)}`,
      },
    };
  }

  // Using session cookie
  return {
    headers: {
      Accept: "application/xml",
      Cookie: `SessionID=${session}`,
    },
  };
}

// ── Fetch with retry (handles BGG 202 "processing" responses) ───────────

async function fetchWithRetry(
  url: string,
  maxRetries = 6
): Promise<Response> {
  const fetchOptions = await getBggFetchOptions();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
      // Session might have expired, clear and retry once
      if (attempt === 0) {
        bggSessionCookie = null;
        bggSessionExpiry = 0;
        const newOptions = await getBggFetchOptions();
        const retryResponse = await fetch(url, newOptions);
        if (retryResponse.status !== 401) return retryResponse;
      }
      throw new Error(
        "No se pudo autenticar con BGG. Verifica las credenciales en BGG_USERNAME y BGG_PASSWORD."
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
 */
export async function validateBggUsername(
  username: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(normalizedUsername)}&own=1&subtype=boardgame&page=1`;
    const fetchOptions = await getBggFetchOptions();
    const response = await fetch(url, fetchOptions);

    // 202 = BGG is preparing data, which means the user exists
    if (response.status === 202 || response.ok) {
      return { valid: true };
    }
    // If we can't authenticate to BGG, don't block the user
    if (response.status === 401) {
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
  // Normalize username to lowercase
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
