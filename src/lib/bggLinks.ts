// Enlaces a páginas de BGG que se pintan tanto en el cliente como en el
// servidor (sin prisma).

// BGG pone el nombre del juego en la URL; si no coincide redirige, así que
// basta con una aproximación.
function bggSlug(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "game"
  );
}

/** La pestaña «Files» de un juego en BGG, donde suelen estar las reglas. */
export function bggFilesUrl(bggId: number, name: string) {
  return `https://boardgamegeek.com/boardgame/${bggId}/${bggSlug(name)}/files`;
}

const FILEPAGE_RE =
  /^(?:https?:\/\/)?(?:www\.)?boardgamegeek\.com\/filepage\/(\d+)(?:\/([a-z0-9-]*))?\/?(?:[?#].*)?$/i;

/**
 * Deja un enlace a la página de un fichero de BGG en su forma limpia
 * (https://boardgamegeek.com/filepage/329062/1953-everest-english-rules).
 * null si no es una página de fichero: nunca enlazamos al PDF en sí.
 */
export function normalizeManualUrl(input: string): string | null {
  const m = input.trim().match(FILEPAGE_RE);
  if (!m) return null;
  const slug = m[2]?.toLowerCase();
  return `https://boardgamegeek.com/filepage/${m[1]}${slug ? `/${slug}` : ""}`;
}

/** «1953 everest english rules», a partir del final del enlace, si lo trae. */
export function manualTitleFromUrl(url: string): string | null {
  const slug = url.match(/\/filepage\/\d+\/([a-z0-9-]+)/i)?.[1];
  return slug ? slug.replace(/-+/g, " ") : null;
}
