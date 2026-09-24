"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

// Piezas de movimiento de la portada y de las páginas internas. Todo con
// IntersectionObserver, transiciones CSS y la Web Animations API: nada de
// librerías, y con `prefers-reduced-motion` todo se queda quieto y visible.

/** true en cuanto el elemento entra en pantalla (y, con `once`, se queda). */
export function useInView<T extends Element>(
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {}
) {
  const { threshold = 0.2, rootMargin = "0px", once = true } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView] as const;
}

type RevealVariant = "up" | "left" | "right" | "scale";

/** Aparece al entrar en pantalla: sube, entra de lado o crece un poco. */
export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  return (
    <div
      ref={ref}
      className={`reveal reveal--${variant} ${inView ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** La barrita ámbar de arriba que se llena según bajas por la página. */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 h-[3px] z-[60] pointer-events-none" aria-hidden>
      <div
        ref={barRef}
        className="h-full origin-left bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--primary)]"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/** Para las animaciones en bucle: con el movimiento reducido, ni arrancan. */
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}

/** Mueve el resplandor de las tarjetas .fx-spotlight hasta donde está el ratón. */
export function spotlightMove(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--sx", `${e.clientX - rect.left}px`);
  el.style.setProperty("--sy", `${e.clientY - rect.top}px`);
}

/**
 * Un número que cuenta desde cero hasta su valor la primera vez que se ve.
 * Pinta el valor final desde el primer render (en el servidor y para los
 * lectores de pantalla) y solo anima si hay movimiento permitido.
 */
export function CountUp({
  value,
  format = (n) => n.toLocaleString("es-ES"),
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!inView || reduced || value === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Arranca rápido y frena al final.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? Math.round(value * eased) : null);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(shown ?? value)}
    </span>
  );
}

/**
 * Animación FLIP para listas que se reordenan: `capture()` justo antes del
 * cambio de estado apunta dónde está cada `[data-flip-id]`, y tras el render
 * cada uno viaja desde su sitio viejo al nuevo en vez de saltar.
 */
export function useFlip<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const snapshot = useRef<Map<string, number> | null>(null);
  const reduced = usePrefersReducedMotion();

  const capture = () => {
    const root = ref.current;
    if (!root || reduced) return;
    const map = new Map<string, number>();
    root.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      map.set(el.dataset.flipId!, el.getBoundingClientRect().top);
    });
    snapshot.current = map;
  };

  useLayoutEffect(() => {
    const snap = snapshot.current;
    const root = ref.current;
    if (!snap || !root) return;
    snapshot.current = null;
    root.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const before = snap.get(el.dataset.flipId!);
      if (before === undefined) return;
      const dy = before - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
        duration: 650,
        easing: "cubic-bezier(0.34, 1.2, 0.64, 1)",
      });
    });
  });

  return { ref, capture };
}
