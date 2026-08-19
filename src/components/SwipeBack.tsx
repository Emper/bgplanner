"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TAB_ROOTS } from "@/lib/navigation";

/**
 * Gesto de retroceso deslizando desde el borde izquierdo.
 *
 * Por qué no usamos el gesto nativo del WebView: `allowsBackForwardNavigationGestures`
 * de WKWebView solo anima bien cuando hay cargas de página completas. El App
 * Router navega con pushState dentro del mismo documento, así que el gesto
 * nativo retrocede sin animación y de forma inconsistente. Lo hacemos aquí y,
 * de paso, funciona igual en Android.
 *
 * El movimiento se hace con transform sobre <body>, sin View Transitions, para
 * que funcione también en iOS anteriores al 18.
 */

/** Ancho de la franja del borde donde se puede iniciar el gesto. */
const EDGE = 24;
/** Desplazamiento a partir del cual damos el gesto por intencionado. */
const ENGAGE = 8;
/** Fracción del ancho a partir de la cual se confirma el retroceso al soltar. */
const COMMIT_RATIO = 0.35;
/** Velocidad (px/ms) que confirma el retroceso aunque no se llegue al umbral. */
const COMMIT_VELOCITY = 0.5;

const SLIDE_OUT_MS = 200;
const SNAP_BACK_MS = 220;
const POP_IN_MS = 240;
const EASING = "cubic-bezier(.32, .72, 0, 1)";

/** ¿El toque nace dentro de algo que ya consume el desplazamiento horizontal? */
function isProtected(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;

  // Zonas marcadas explícitamente (carruseles, tiras de pestañas, sliders).
  if (el.closest("[data-no-swipe]")) return true;
  // Un modal abierto se cierra con su propio botón, no retrocediendo.
  if (el.closest('[role="dialog"]')) return true;
  // Campos de texto: el arrastre mueve el cursor.
  if (el.closest("input, textarea, select")) return true;

  // Cualquier ancestro con scroll horizontal real (las barras de pestañas
  // usan overflow-x-auto).
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

export default function SwipeBack() {
  const router = useRouter();
  const pathname = usePathname();

  // Marca que hemos lanzado un router.back() y esperamos a la nueva ruta para
  // animar la entrada de la página anterior.
  const awaitingPop = useRef(false);
  const pathnameRef = useRef(pathname);

  // Animación de entrada de la página anterior, una vez confirmada la vuelta.
  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;

    if (!awaitingPop.current) return;
    awaitingPop.current = false;

    const body = document.body;
    // La página anterior entra desde la izquierda con un poco de parallax,
    // igual que en iOS.
    body.style.transition = "none";
    body.style.transform = "translateX(-28%)";
    body.style.opacity = "0.6";

    requestAnimationFrame(() => {
      body.style.transition = `transform ${POP_IN_MS}ms ${EASING}, opacity ${POP_IN_MS}ms ${EASING}`;
      body.style.transform = "translateX(0)";
      body.style.opacity = "1";

      setTimeout(() => {
        body.style.transition = "";
        body.style.transform = "";
        body.style.opacity = "";
        document.documentElement.removeAttribute("data-swiping");
      }, POP_IN_MS);
    });
  }, [pathname]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let dx = 0;
    let tracking = false; // el toque nació en el borde
    let engaged = false; // ya hemos confirmado que es un gesto horizontal

    const body = document.body;

    const reset = () => {
      tracking = false;
      engaged = false;
      dx = 0;
    };

    const clearVisualState = () => {
      body.style.transition = "";
      body.style.transform = "";
      document.documentElement.removeAttribute("data-swiping");
    };

    const onTouchStart = (e: TouchEvent) => {
      reset();
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      if (touch.clientX > EDGE) return;
      // Desde la raíz de una pestaña no se retrocede: ahí "atrás" sale de la app.
      if (TAB_ROOTS.includes(window.location.pathname)) return;
      if (window.history.length <= 1) return;
      if (isProtected(e.target)) return;

      startX = touch.clientX;
      startY = touch.clientY;
      startTime = e.timeStamp;
      tracking = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!engaged) {
        // Intención vertical: es scroll, no retroceso.
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          reset();
          return;
        }
        if (deltaX < ENGAGE) return;

        engaged = true;
        document.documentElement.setAttribute("data-swiping", "");
        body.style.transition = "none";
      }

      dx = Math.max(0, deltaX);
      // preventDefault evita que el gesto arrastre también el scroll vertical.
      if (e.cancelable) e.preventDefault();
      body.style.transform = `translateX(${dx}px)`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!engaged) {
        reset();
        return;
      }

      const width = window.innerWidth;
      const elapsed = Math.max(1, e.timeStamp - startTime);
      const velocity = dx / elapsed;
      const commit = dx > width * COMMIT_RATIO || velocity > COMMIT_VELOCITY;

      if (commit) {
        // Termina de sacar la página y, cuando ya no se ve, retrocede. La
        // entrada de la página anterior la anima el efecto de arriba.
        body.style.transition = `transform ${SLIDE_OUT_MS}ms ${EASING}`;
        body.style.transform = `translateX(${width}px)`;
        awaitingPop.current = true;

        setTimeout(() => {
          router.back();
          // Red de seguridad: si por lo que sea no cambia la ruta, no dejamos
          // la pantalla en blanco.
          setTimeout(() => {
            if (awaitingPop.current) {
              awaitingPop.current = false;
              clearVisualState();
            }
          }, 700);
        }, SLIDE_OUT_MS);
      } else {
        body.style.transition = `transform ${SNAP_BACK_MS}ms ${EASING}`;
        body.style.transform = "translateX(0)";
        setTimeout(clearVisualState, SNAP_BACK_MS);
      }

      reset();
    };

    const onTouchCancel = () => {
      if (engaged) {
        body.style.transition = `transform ${SNAP_BACK_MS}ms ${EASING}`;
        body.style.transform = "translateX(0)";
        setTimeout(clearVisualState, SNAP_BACK_MS);
      }
      reset();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      clearVisualState();
    };
  }, [router]);

  return null;
}
