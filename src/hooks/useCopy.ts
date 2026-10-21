"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";

/**
 * Para los botones de «Copiar»: `copied` vale true un par de segundos solo
 * si la copia salió bien. Si falla, `copy` devuelve false para avisar.
 */
export function useCopy(ms = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text);
      if (ok) {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), ms);
      }
      return ok;
    },
    [ms]
  );

  return { copied, copy };
}
