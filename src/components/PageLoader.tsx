"use client";

import { useMemo } from "react";

// Dot positions for each dice face (1-6)
const DICE_FACES: Record<number, [number, number][]> = {
  1: [[20, 20]],
  2: [[13, 13], [27, 27]],
  3: [[13, 13], [20, 20], [27, 27]],
  4: [[13, 13], [27, 13], [13, 27], [27, 27]],
  5: [[13, 13], [27, 13], [20, 20], [13, 27], [27, 27]],
  6: [[13, 13], [27, 13], [13, 20], [27, 20], [13, 27], [27, 27]],
};

/**
 * Animated page-level loader with rolling dice.
 * Use for full-page loading states and Suspense fallbacks.
 */
export default function PageLoader({ withNavbar = false }: { withNavbar?: boolean }) {
  const face = useMemo(() => Math.floor(Math.random() * 6) + 1, []);
  const dots = DICE_FACES[face];

  return (
    <div className={`${withNavbar ? "" : "min-h-screen"} flex flex-col items-center justify-center py-24 gap-5`}>
      <div className="relative w-12 h-12">
        {/* Rolling dice */}
        <svg
          viewBox="0 0 40 40"
          className="w-12 h-12 animate-[roll_1.2s_ease-in-out_infinite] text-[var(--primary)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="4" y="4" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
          {dots.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.2" fill="currentColor" opacity="0.8" />
          ))}
        </svg>
      </div>
      <p className="text-sm text-[var(--text-muted)] animate-pulse">
        Cargando...
      </p>

      <style>{`
        @keyframes roll {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(0.92); }
          50% { transform: rotate(180deg) scale(1); }
          75% { transform: rotate(270deg) scale(0.92); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
