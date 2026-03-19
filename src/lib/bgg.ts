import { parseStringPromise } from "xml2js";
import { prisma } from "@/lib/prisma";

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
  dateAdded: Date | null;
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

// DB-backed collection cache — refreshes once per day or on demand
const COLLECTION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── BGG Session Management ──────────────────────────────────────────────
// BGG now requires authentication for API access. We log in with a BGG
// account and use the session cookie for all subsequent requests.
// This avoids needing a registered application + Bearer token.

let bggCookieString: string | null = null;
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

  const payload = JSON.stringify({
    credentials: { username, password },
  });

  console.log(`[BGG Login] Attempting login for user: ${username}`);

  const response = await fetch("https://boardgamegeek.com/login/api/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: payload,
    redirect: "manual", // Don't follow redirects, we just need the cookie
  });

  console.log(`[BGG Login] Response status: ${response.status}`);

  // BGG returns 200 or 302 on success, 400/401 on failure
  if (response.status >= 400) {
    const body = await response.text();
    console.log(`[BGG Login] Error body: ${body}`);
    let errorMsg = "Error al iniciar sesión en BGG.";
    try {
      const parsed = JSON.parse(body);
      if (parsed.errors?.message) errorMsg = parsed.errors.message;
    } catch {
      // ignore parse error
    }
    throw new Error(`Login BGG fallido (${response.status}): ${errorMsg}`);
  }

  // Extract ALL cookies from response — BGG needs all of them, not just SessionID
  const cookiePairs: string[] = [];

  if (typeof response.headers.getSetCookie === "function") {
    const setCookies = response.headers.getSetCookie();
    console.log(`[BGG Login] getSetCookie returned ${setCookies.length} cookies`);
    for (const cookie of setCookies) {
      // Extract "name=value" from "name=value; path=/; ..."
      const nameValue = cookie.split(";")[0].trim();
      if (nameValue && nameValue.includes("=")) {
        cookiePairs.push(nameValue);
      }
    }
  } else {
    // Fallback: raw header
    const rawCookie = response.headers.get("set-cookie") || "";
    console.log(`[BGG Login] Raw set-cookie length: ${rawCookie.length}`);
    // Split by comma but not within expires dates
    const parts = rawCookie.split(/,(?=\s*(?:\w+=))/);
    for (const part of parts) {
      const nameValue = part.split(";")[0].trim();
      if (nameValue && nameValue.includes("=")) {
        cookiePairs.push(nameValue);
      }
    }
  }

  if (cookiePairs.length === 0) {
    const headerEntries: string[] = [];
    response.headers.forEach((value, key) => {
      headerEntries.push(`${key}: ${value.substring(0, 100)}`);
    });
    console.log(`[BGG Login] All response headers: ${headerEntries.join(" | ")}`);
    throw new Error(
      "No se pudo obtener cookies de sesión de BGG. Verifica las credenciales."
    );
  }

  const cookieString = cookiePairs.join("; ");
  console.log(`[BGG Login] Success! ${cookiePairs.length} cookies captured. Names: ${cookiePairs.map(c => c.split("=")[0]).join(", ")}`);
  return cookieString;
}

async function getBggCookies(): Promise<string> {
  // Also support Bearer token as alternative
  const token = process.env.BGG_API_TOKEN;
  if (token) {
    return `__bearer__${token}`;
  }

  if (bggCookieString && Date.now() < bggSessionExpiry) {
    return bggCookieString;
  }

  const cookies = await loginToBgg();
  bggCookieString = cookies;
  bggSessionExpiry = Date.now() + BGG_SESSION_TTL;
  return cookies;
}

async function getBggFetchOptions(): Promise<RequestInit> {
  const cookies = await getBggCookies();

  // If using Bearer token
  if (cookies.startsWith("__bearer__")) {
    return {
      headers: {
        Accept: "application/xml",
        Authorization: `Bearer ${cookies.slice("__bearer__".length)}`,
      },
    };
  }

  // Using all session cookies
  return {
    headers: {
      Accept: "application/xml",
      Cookie: cookies,
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
    console.log(`[BGG Fetch] Attempt ${attempt + 1}: ${url.substring(0, 80)}...`);
    const response = await fetch(url, fetchOptions);
    console.log(`[BGG Fetch] Response: ${response.status}`);

    if (response.status === 401) {
      if (attempt === 0) {
        // Try re-authenticating
        console.log("[BGG Fetch] Got 401, re-authenticating...");
        bggCookieString = null;
        bggSessionExpiry = 0;
        const newOptions = await getBggFetchOptions();
        const retryResponse = await fetch(url, newOptions);
        console.log(`[BGG Fetch] Retry after re-auth: ${retryResponse.status}`);
        if (retryResponse.status !== 401) return retryResponse;

        // Fallback: try without auth (some BGG endpoints are public)
        console.log("[BGG Fetch] Auth failed, trying without auth...");
        const publicResponse = await fetch(url, {
          headers: { Accept: "application/xml" },
        });
        console.log(`[BGG Fetch] Public response: ${publicResponse.status}`);
        if (publicResponse.ok || publicResponse.status === 202) {
          return publicResponse;
        }
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

  const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(normalizedUsername)}&own=1&stats=1`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No se encontró el usuario "${username}" en BGG.`);
    }
    throw new Error(`Error al obtener colección de BGG: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });

  if (!parsed.items?.item) {
    // Empty collection — clear existing rows
    await prisma.collectionGame.deleteMany({ where: { bggUsername: normalizedUsername } });
    return true;
  }

  const items = Array.isArray(parsed.items.item)
    ? parsed.items.item
    : [parsed.items.item];

  const now = new Date();
  const games: BggCollectionItem[] = items
    .filter((item: any) => item.$.subtype === "boardgame")
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
        bggRating: rating?.average ? parseFloat(rating.average.$?.value) || null : null,
        bggRank: mainRank ? parseInt(mainRank.$?.value) || null : null,
        weight: rating?.averageweight ? parseFloat(rating.averageweight.$?.value) || null : null,
        numPlays: item.numplays ? parseInt(item.numplays) : 0,
        userRating: rating ? parseFloat(rating.$?.value) || null : null,
        dateAdded: item.status?.$?.lastmodified ? new Date(item.status.$.lastmodified) : null,
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
        numPlays: g.numPlays,
        userRating: g.userRating,
        bestWith: bestWithMap.get(g.bggId) || null,
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
