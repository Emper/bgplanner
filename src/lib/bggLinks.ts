// El enlace al manual de un juego: lo que se valida igual en el cliente y en
// el servidor (sin prisma).

const FILEPAGE_RE = /^\/filepage\/(\d+)(?:\/([a-z0-9-]*))?\/?$/i;

// URLs firmadas que funcionan un rato y mueren: S3 (v4 y v2), Google Cloud
// Storage, CloudFront y Azure. Los nombres sueltos («signature», «sig») solo
// cuentan junto a su caducidad o su clave, para no tumbar enlaces normales.
const SIGNED_PARAMS = ["x-amz-signature", "x-amz-credential", "x-amz-expires", "x-goog-signature", "x-goog-expires", "awsaccesskeyid", "key-pair-id"];

function isSignedUrl(params: string[]) {
  const has = (k: string) => params.includes(k);
  if (params.some((k) => SIGNED_PARAMS.includes(k))) return true;
  if (has("signature") && (has("expires") || has("policy"))) return true; // S3 v2, CloudFront
  if (has("sig") && (has("se") || has("sv"))) return true; // Azure SAS
  return false;
}

const EXPIRING_ERROR =
  "Ese enlace es temporal y dejará de funcionar en un rato. Usa la página del fichero en BGG (boardgamegeek.com/filepage/…) o un enlace de Drive, Dropbox o la web de la editorial.";

export type ManualUrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * ¿Sirve como enlace al manual? Vale cualquier página (la del fichero en BGG,
 * Drive, Dropbox, la web de la editorial…) salvo los enlaces que caducan: las
 * descargas de BGG (download_redirect) y las URLs firmadas de S3 y similares.
 * Las de BGG se dejan en su forma limpia.
 */
export function checkManualUrl(input: string): ManualUrlCheck {
  let url: URL;
  try {
    const text = input.trim();
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: "Eso no parece un enlace" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Eso no parece un enlace" };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".") || host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) {
    return { ok: false, error: "Eso no parece un enlace" };
  }

  if (host === "boardgamegeek.com") {
    const m = url.pathname.match(FILEPAGE_RE);
    if (m) {
      const slug = m[2]?.toLowerCase();
      return { ok: true, url: `https://boardgamegeek.com/filepage/${m[1]}${slug ? `/${slug}` : ""}` };
    }
    if (url.pathname.startsWith("/file/")) return { ok: false, error: EXPIRING_ERROR };
  }

  if (host.endsWith("amazonaws.com") || host.includes("geekdo-files")) {
    return { ok: false, error: EXPIRING_ERROR };
  }
  const params = [...url.searchParams.keys()].map((k) => k.toLowerCase());
  if (isSignedUrl(params)) {
    return { ok: false, error: EXPIRING_ERROR };
  }

  return { ok: true, url: url.toString() };
}

/** «1953 everest english rules», a partir del final del enlace a BGG, si lo trae. */
export function manualTitleFromUrl(url: string): string | null {
  const slug = url.match(/boardgamegeek\.com\/filepage\/\d+\/([a-z0-9-]+)/i)?.[1];
  return slug ? slug.replace(/-+/g, " ") : null;
}

/** Dónde está el manual, en corto: «BGG», «Drive», «Dropbox», «devir.es»… */
export function manualSourceLabel(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
  if (host === "boardgamegeek.com") return "BGG";
  if (host.endsWith("drive.google.com") || host.endsWith("docs.google.com")) return "Drive";
  if (host.endsWith("dropbox.com") || host.endsWith("dropboxusercontent.com")) return "Dropbox";
  if (host.endsWith("onedrive.live.com") || host === "1drv.ms" || host.endsWith("sharepoint.com")) return "OneDrive";
  return host;
}

// ── Enlaces a BoardGameGeek ─────────────────────────────────────────────

const BGG = "https://boardgamegeek.com";

/** La ficha de un juego (o de una expansión) en BGG. */
export function bggGameUrl(bggId: number, { expansion = false }: { expansion?: boolean } = {}): string {
  return `${BGG}/${expansion ? "boardgameexpansion" : "boardgame"}/${bggId}`;
}

/** El perfil de un usuario de BGG (los nombres pueden llevar espacios). */
export function bggUserUrl(username: string): string {
  return `${BGG}/user/${encodeURIComponent(username)}`;
}

/** Una geeklist de BGG. */
export function bggGeeklistUrl(id: number | string): string {
  return `${BGG}/geeklist/${id}`;
}
