"use client";

/**
 * Animated page-level loader with rolling dice.
 * Use for full-page loading states and Suspense fallbacks.
 */
export default function PageLoader({ withNavbar = false }: { withNavbar?: boolean }) {
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
          {/* Dice dots - face showing 5 */}
          <circle cx="13" cy="13" r="2.2" fill="currentColor" opacity="0.8" />
          <circle cx="27" cy="13" r="2.2" fill="currentColor" opacity="0.8" />
          <circle cx="20" cy="20" r="2.2" fill="currentColor" opacity="0.8" />
          <circle cx="13" cy="27" r="2.2" fill="currentColor" opacity="0.8" />
          <circle cx="27" cy="27" r="2.2" fill="currentColor" opacity="0.8" />
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
