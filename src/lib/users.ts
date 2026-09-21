/**
 * Enlace al perfil público de un jugador.
 *
 * Usamos su usuario de BGG como slug para tener URLs amigables
 * (/users/emper) sin inventarnos un campo nuevo, y caemos al id cuando
 * todavía no ha conectado BGG. Ojo: `bggUsername` no es único en la BD ni
 * es inmutable, así que el id sigue siendo el enlace permanente y el que
 * resuelve primero el endpoint.
 */
export function profileHref(user: {
  id: string;
  bggUsername?: string | null;
}): string {
  const slug = user.bggUsername?.trim();
  return `/users/${encodeURIComponent(slug || user.id)}`;
}
