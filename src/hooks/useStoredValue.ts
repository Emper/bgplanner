"use client";

import { useSyncExternalStore } from "react";
import { readStorage } from "@/lib/storage";

// Lo guardado en localStorage, leído sin desajustes con lo pintado en el
// servidor: allí no hay almacenamiento y sale null; React aplica el valor
// guardado al hidratar, sin un render de más ni aviso. Para recordar
// preferencias (una caja plegada, un orden).

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStorage(key),
    () => null
  );
}
