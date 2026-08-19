"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Deslizar hacia abajo para recargar.
 *
 * Solo se activa con el scroll arriba del todo y en dispositivos táctiles.
 * El rebote nativo del WebView está desactivado en globals.css, así que este
 * gesto no compite con él.
 */

/** Desplazamiento a partir del cual se dispara la recarga al soltar. */
const THRESHOLD = 72;
/** Tope del arrastre: a partir de aquí el indicador ya no baja más. */
const MAX_PULL = 110;
/** Resistencia: el indicador se mueve menos que el dedo. */
const RESISTANCE = 0.5;

export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    let startY = 0;
    let tracking = false;
    let engaged = false;
    let current = 0;

    const onTouchStart = (e: TouchEvent) => {
      tracking = false;
      engaged = false;
      current = 0;
      if (e.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;

      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) {
        if (engaged) {
          engaged = false;
          current = 0;
          setPull(0);
        }
        return;
      }
      // Si el usuario ya ha bajado la página, no es un tirón de recarga.
      if (window.scrollY > 0) return;

      if (!engaged) {
        if (delta < 8) return;
        engaged = true;
      }

      current = Math.min(MAX_PULL, delta * RESISTANCE);
      if (e.cancelable) e.preventDefault();
      setPull(current);
    };

    const onTouchEnd = async () => {
      if (!engaged) {
        tracking = false;
        return;
      }
      tracking = false;
      engaged = false;

      if (current >= THRESHOLD) {
        setPull(THRESHOLD);
        setRefreshing(true);
        try {
          await onRefreshRef.current();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
      current = 0;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const active = pull > 0 || refreshing;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <>
      {/* Indicador: aparece por debajo de la barra superior mientras se tira. */}
      <div
        aria-hidden={!active}
        className="sm:hidden fixed left-0 right-0 z-30 flex justify-center pointer-events-none"
        style={{
          top: "calc(var(--safe-top) + 3.25rem)",
          transform: `translateY(${pull - 32}px)`,
          opacity: active ? 1 : 0,
          transition: pull === 0 ? "transform 220ms ease, opacity 220ms ease" : "opacity 120ms ease",
        }}
      >
        <span className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--card-shadow)] flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            className={`w-4 h-4 text-[var(--primary)] ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992M3.51 9.348a8.25 8.25 0 0113.803-3.03L21 9.348m-18 5.304l3.687 3.03A8.25 8.25 0 0020.49 14.652"
            />
          </svg>
        </span>
      </div>

      <div
        style={{
          transform: pull > 0 ? `translateY(${pull * 0.35}px)` : undefined,
          transition: pull === 0 ? "transform 220ms cubic-bezier(.32,.72,0,1)" : "none",
        }}
      >
        {children}
      </div>
    </>
  );
}
