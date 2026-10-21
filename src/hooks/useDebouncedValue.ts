"use client";

import { useEffect, useState } from "react";

/** El valor, pero solo cuando lleva `ms` sin cambiar (búsquedas al teclear). */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
