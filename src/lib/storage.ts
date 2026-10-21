// localStorage sin sustos: en una ventana privada, con el almacenamiento
// bloqueado o en el servidor, leer devuelve null y escribir no hace nada.
// Nunca para nada que tenga que persistir de verdad: solo comodidades
// (la vista elegida, un aviso ya visto, un borrador).

export function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: nos quedamos sin recordarlo, nada más.
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Igual que arriba.
  }
}

/** Para guardar objetos: JSON dentro, y null si lo guardado no se entiende. */
export function readStorageJson<T>(key: string): T | null {
  const raw = readStorage(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStorageJson(key: string, value: unknown): void {
  writeStorage(key, JSON.stringify(value));
}
