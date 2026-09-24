"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileBadge } from "@/lib/profileBadges";

// Las insignias del perfil en una sola fila que se desliza: fichas estrechas
// con el icono arriba y el texto debajo. El nivel no se escribe, lo dice el
// color: bronce, plata y oro. Las que faltan van en gris al final.

const CARD = [
  "border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40",
  "border-orange-700/35 bg-orange-700/[0.06]",
  "border-slate-400/50 bg-slate-400/[0.08]",
  "border-amber-400/60 bg-amber-400/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
];
const MEDAL = [
  "ring-[var(--border)] bg-[var(--surface-hover)]",
  "ring-orange-700/60 bg-orange-700/15",
  "ring-slate-400/70 bg-slate-400/15",
  "ring-amber-400 bg-amber-400/20",
];
const NAME = [
  "text-[var(--text-muted)]",
  "text-orange-700 dark:text-orange-400",
  "text-slate-500 dark:text-slate-300",
  "text-amber-600 dark:text-amber-400",
];

function BadgeCard({ badge, isSelf }: { badge: ProfileBadge; isSelf: boolean }) {
  const locked = badge.tier === 0;
  return (
    <div
      className={`snap-start shrink-0 w-[116px] sm:w-[128px] flex flex-col items-center text-center px-2.5 pt-3.5 pb-3 rounded-2xl border ${CARD[badge.tier]}`}
      title={
        badge.next
          ? `Siguiente nivel: ${badge.next.name} (${badge.next.at.toLocaleString("es-ES")})`
          : badge.tierName ?? undefined
      }
    >
      {/* Las ganadas brillan de vez en cuando; cada una a su ritmo, según su sitio */}
      <div
        className={`relative w-12 h-12 rounded-full ring-2 flex items-center justify-center text-2xl ${MEDAL[badge.tier]} ${
          locked ? "" : "fx-shine overflow-hidden"
        }`}
        style={locked ? undefined : { animationDelay: `${(badge.key.length % 5) * 0.7}s` }}
      >
        <span className={locked ? "grayscale opacity-40" : ""} aria-hidden>
          {badge.emoji}
        </span>
        {locked && (
          <span className="absolute -bottom-1 -right-1 text-xs" aria-label="Bloqueada">
            🔒
          </span>
        )}
      </div>

      <p
        className={`mt-2.5 text-xs font-semibold leading-tight ${
          locked ? "text-[var(--text-muted)]" : "text-[var(--text)]"
        }`}
      >
        {badge.text}
      </p>
      <p className={`mt-1 text-[10px] leading-tight ${NAME[badge.tier]}`}>
        {locked ? (isSelf ? badge.hint : "Por desbloquear") : badge.tierName}
      </p>

      {/* La barra hacia el siguiente nivel es cosa tuya: en el perfil de
          otro sería señalarle lo que le falta. */}
      {isSelf && (
        <div className="mt-auto pt-2.5 w-full">
          <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className={`h-full rounded-full ${locked ? "bg-[var(--text-muted)]" : "bg-[var(--primary)]"}`}
              style={{ width: `${Math.max(4, Math.round(badge.progress * 100))}%` }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            {badge.next
              ? `${badge.value.toLocaleString("es-ES")}/${badge.next.at.toLocaleString("es-ES")}`
              : "Nivel máximo"}
          </p>
        </div>
      )}
    </div>
  );
}

function Arrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Anteriores" : "Siguientes"}
      className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "-left-3" : "-right-3"
      } z-10 w-8 h-8 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--card-shadow)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50 transition-all duration-200`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={side === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </button>
  );
}

export default function BadgeCarousel({
  badges,
  isSelf,
}: {
  badges: ProfileBadge[];
  isSelf: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Las flechas y los degradados solo salen si queda algo por ese lado.
  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canLeft && <Arrow side="left" onClick={() => scroll(-1)} />}
      {canRight && <Arrow side="right" onClick={() => scroll(1)} />}
      {canLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 z-[5] bg-gradient-to-r from-[var(--surface)] to-transparent" />
      )}
      {canRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 z-[5] bg-gradient-to-l from-[var(--surface)] to-transparent" />
      )}
      <div
        ref={scroller}
        onScroll={update}
        className="flex items-stretch gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-1 p-1 py-2 fx-stagger"
      >
        {badges.map((badge) => (
          <BadgeCard key={badge.key} badge={badge} isSelf={isSelf} />
        ))}
      </div>
    </div>
  );
}
