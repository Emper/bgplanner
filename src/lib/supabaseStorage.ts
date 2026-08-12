import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Cliente de Supabase Storage con service role (solo servidor). Se usa para
// subir fotos de las opiniones de partida al bucket `game-photos`.
//
// Requiere en el entorno (Vercel):
//   - SUPABASE_URL                  → URL del proyecto (https://xxxx.supabase.co)
//   - SUPABASE_SERVICE_ROLE_KEY     → service_role key (NUNCA exponer al cliente)
//
// El bucket `game-photos` debe existir y ser de lectura pública.

export const PHOTOS_BUCKET = "game-photos";

let cached: SupabaseClient | null = null;

export function getStorageClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  const path = `${keyPrefix}/${name}`.replace(/\/+/g, "/");

  const { error } = await client.storage
    .from(PHOTOS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) {
    throw new Error(`Error al subir la imagen: ${error.message}`);
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
