import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Cliente de Supabase Storage con service role (solo servidor). Se usa para
// subir fotos (opiniones de partida y galerías de grupo/evento) al bucket
// `game-photos`.
//
// Requiere en el entorno (Vercel):
//   - SUPABASE_URL                  → URL del proyecto (https://xxxx.supabase.co)
//   - SUPABASE_SERVICE_ROLE_KEY     → service_role key (NUNCA exponer al cliente)
//
// El bucket `game-photos` debe existir y ser de lectura pública.

export const PHOTOS_BUCKET = "game-photos";

let cached: SupabaseClient | null = null;

export function getStorageClient(): SupabaseClient | null {
  // Normalizar la URL del proyecto: hay que pasar solo la raíz
  // (https://xxxx.supabase.co). Un sufijo típico mal copiado como
  // /rest/v1 o /storage/v1 —o una barra final— provoca
  // "Invalid path specified in request URL" al subir. Los quitamos.
  const url = process.env.SUPABASE_URL?.trim()
    .replace(/\/(rest|storage|auth|realtime)\/v\d+\/?$/i, "")
    .replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface UploadedPhoto {
  url: string;
  path: string;
}

/**
 * Sube un buffer de imagen al bucket y devuelve la URL pública.
 * `keyPrefix` agrupa las fotos (p.ej. `groups/{groupId}`).
 * Lanza si el tipo no está permitido o si Storage no está configurado.
 */
export async function uploadPhoto(
  buffer: Buffer,
  contentType: string,
  keyPrefix: string
): Promise<UploadedPhoto> {
  const client = getStorageClient();
  if (!client) {
    throw new Error("Storage no configurado");
  }
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    throw new Error("Formato de imagen no soportado");
  }
  // Nombre único con randomUUID del módulo crypto de Node (evita depender del
  // global `crypto`, que no siempre está según la versión del runtime).
  const name = `${randomUUID()}.${ext}`;
  // Clave del objeto: sin barra inicial y sin barras duplicadas (Supabase
  // rechaza rutas mal formadas con "Invalid path specified in request URL").
  const path = `${keyPrefix}/${name}`.replace(/\/+/g, "/").replace(/^\/+/, "");

  const { error } = await client.storage
    .from(PHOTOS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) {
    // El detalle real va a los logs; al usuario un mensaje limpio.
    console.error("[storage] fallo al subir imagen:", { path, message: error.message });
    throw new Error("No se pudo subir la imagen");
  }

  const { data } = client.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Borra fotos del bucket a partir de sus paths. Fire-and-forget seguro. */
export async function deletePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const client = getStorageClient();
  if (!client) return;
  await client.storage.from(PHOTOS_BUCKET).remove(paths).catch?.(() => {});
}

/** Extrae el path del bucket a partir de una URL pública almacenada. */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${PHOTOS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
