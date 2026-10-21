"use client";

import { useEffect, useRef } from "react";

/** Llama a `onEscape` al pulsar Escape mientras `enabled` sea true. */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
