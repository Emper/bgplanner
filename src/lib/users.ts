// Helpers del perfil público. Sin dependencias de servidor: esto lo importan
// también componentes de cliente.

/**
 * Enlace al perfil público de un jugador: su slug si lo tiene, y si no su id,
 * que siempre funciona como enlace permanente.
 */
export function profileHref(user: {
  id: string;
  slug?: string | null;
}): string {
  const slug = user.slug?.trim();
  return `/users/${encodeURIComponent(slug || user.id)}`;
}

// Los ids son cuid (25 caracteres, empiezan por "c"). Un slug con esa pinta
// podría tapar el enlace permanente de otra persona, así que no se reclama.
const CUID_SHAPE = /^c[a-z0-9]{24}$/;

const SLUG_MIN = 2;
const SLUG_MAX = 30;

/**
 * Convierte un usuario de BGG en slug de URL. Devuelve null si no queda nada
 * aprovechable o si el resultado no sirve como slug.
 */
export function slugifyUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return null;
  if (CUID_SHAPE.test(slug)) return null;
  return slug;
}
