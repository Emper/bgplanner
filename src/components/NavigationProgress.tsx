"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// La barra fina de arriba mientras se navega. Las páginas que se pintan en el
// servidor no cambian hasta tener sus datos, y sin nada que lo indique parecía
// que el clic no había hecho nada. Arranca al pulsar un enlace interno (o al
// ir atrás o adelante) y termina cuando cambia la página. Si la navegación es
// rápida ni se llega a ver, para no parpadear.

const SHOW_AFTER_MS = 120;
// Por si un clic no acaba navegando (algo cancela el enlace): que no se quede.
const GIVE_UP_MS = 12_000;

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || !anchor.href || anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Solo cambia el ancla (#…) o es la misma página: no hay navegación.
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickle = useRef<ReturnType<typeof setInterval>>(undefined);
  const active = useRef(false);
  const finishRef = useRef(() => {});

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearInterval(trickle.current);
  };

  // Arrancar: escucha los clics en enlaces y el atrás/adelante del navegador.
  useEffect(() => {
    const start = () => {
      clearTimers();
      active.current = true;
      timers.current.push(
        setTimeout(() => {
          if (!active.current) return;
          setVisible(true);
          setProgress(0.15);
          // Avanza cada vez más despacio sin llegar nunca al final.
          trickle.current = setInterval(() => {
            setProgress((p) => p + (0.9 - p) * 0.1);
          }, 200);
        }, SHOW_AFTER_MS),
        setTimeout(() => finishRef.current(), GIVE_UP_MS)
      );
    };
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      clearTimers();
    };
  }, []);

  // Terminar: llena la barra y la desvanece.
  useEffect(() => {
    finishRef.current = () => {
      if (!active.current) return;
      active.current = false;
      clearTimers();
      setProgress(1);
      timers.current.push(
        setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 250)
      );
    };
  });

  // La página nueva ya está: fin.
  useEffect(() => {
    finishRef.current();
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="fixed top-0 inset-x-0 z-[90] h-[3px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]"
        style={{
          width: `${progress * 100}%`,
          transition: progress === 0 ? "none" : "width 200ms ease-out",
        }}
      />
    </div>
  );
}

export default function NavigationProgress() {
  // useSearchParams necesita su propio Suspense para no frenar el layout.
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
