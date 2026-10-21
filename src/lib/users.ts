// Helpers del perfil público. Sin dependencias de servidor: esto lo importan
// también componentes de cliente.

// Cuenta borrada: lo que dejó en sitios compartidos pasa a un usuario
// «fantasma» con este nombre y este rol (ver src/lib/accountDeletion.ts).
export const DELETED_USER_NAME = "Usuario eliminado";
export const DELETED_USER_ROLE = "deleted";

/**
 * Cómo se llama alguien en la app: su nombre visible y, si no tiene, su
 * nombre. Nunca su email: es un dato privado que no se enseña a nadie, ni a
 * sus amigos ni a la gente de sus grupos.
 */
export function displayName(
  user: { displayName?: string | null; name?: string | null } | null | undefined,
  fallback = "Jugador"
): string {
  return user?.displayName?.trim() || user?.name?.trim() || fallback;
}

/** Lo que se puede contar de un usuario a cualquiera que lo vea en la app. */
export const PUBLIC_USER_SELECT = {
  id: true,
  slug: true,
  name: true,
  displayName: true,
  avatarUrl: true,
} as const;

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
