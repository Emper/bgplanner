import crypto from "crypto";

// Avatares y carteles de evento se guardan como data URL (base64) en la
// propia fila. Meterlos tal cual en el HTML pesaba: un perfil llegaba a
// 700 KB, con el mismo avatar repetido en cada línea de actividad y carteles
// de 100 KB para miniaturas de 56 px. Aquí se cambian por una URL de
// /api/img, que el navegador descarga una vez y guarda en caché.
//
// La `v` es una huella del contenido: si la imagen cambia, cambia la URL y la
// caché (inmutable) no sirve la vieja. Las URLs normales (https) se dejan.

export type StoredImageKind = "avatar" | "event";

export function storedImageSrc(
  kind: StoredImageKind,
  id: string,
  value: string | null | undefined
): string | null {
  if (!value) return null;
  if (!value.startsWith("data:")) return value;
  const v = crypto.createHash("sha1").update(value).digest("base64url").slice(0, 12);
  return `/api/img/${kind}/${encodeURIComponent(id)}?v=${v}`;
}

// Solo formatos de imagen que el navegador pinta sin ejecutar nada: un SVG
// servido desde nuestro dominio podría llevar scripts.
const SAFE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Decodifica un data URL de imagen; null si no es uno de los formatos seguros. */
export function decodeImageDataUrl(value: string): { type: string; bytes: Buffer } | null {
  const match = /^data:([a-z0-9/+.-]+);base64,(.+)$/i.exec(value);
  if (!match) return null;
  const type = match[1].toLowerCase();
  if (!SAFE_TYPES.has(type)) return null;
  return { type, bytes: Buffer.from(match[2], "base64") };
}
