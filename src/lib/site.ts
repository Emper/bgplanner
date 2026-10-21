// La dirección pública de la web, para enlaces absolutos (emails, metadatos,
// avisos push, sitemap). En local o en una preview sale de la variable de
// entorno; si falta, la de producción, nunca un "undefined/…".
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app"
).replace(/\/+$/, "");

/** `/groups/abc` → `https://bgplanner.app/groups/abc` */
export function absoluteUrl(path: string): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** El login que, al entrar, te devuelve a donde estabas. */
export function loginHref(redirectTo?: string | null): string {
  return redirectTo
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/login";
}
