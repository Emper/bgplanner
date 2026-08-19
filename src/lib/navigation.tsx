"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Navegación con transiciones tipo app.
 *
 * El App Router navega con pushState dentro del mismo documento, así que el
 * gesto nativo de retroceso del WebView no anima nada. Lo resolvemos aquí:
 * envolvemos cada navegación en la View Transitions API y marcamos la
 * dirección en <html data-nav="push|pop"> para que globals.css sepa si tiene
 * que deslizar hacia dentro o hacia fuera.
 *
 * El truco necesario: startViewTransition espera a que su callback resuelva,
 * pero router.push() no devuelve una promesa que espere al render. Así que
 * dejamos la promesa pendiente y la resolvemos cuando cambia el pathname.
 */

type Direction = "push" | "pop";

type NavContextValue = {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
  /** Rutas raíz de las pestañas: desde ellas, "atrás" sale de la app. */
  isTabRoot: boolean;
};

const NavContext = createContext<NavContextValue | null>(null);

/** Rutas que son la raíz de una pestaña de la barra inferior. */
export const TAB_ROOTS = ["/inicio", "/groups", "/events", "/profile"];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function supportsViewTransitions() {
  return (
    typeof document !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (document as any).startViewTransition === "function"
  );
}

export function NavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Resolver de la transición en curso, a la espera de que cambie la ruta.
  const pendingRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cuando la ruta cambia, damos por terminado el cambio de DOM y dejamos que
  // la View Transition anime.
  useEffect(() => {
    if (pendingRef.current) {
      clearTimeout(timeoutRef.current);
      pendingRef.current();
      pendingRef.current = null;
    }
  }, [pathname]);

  const run = useCallback((direction: Direction, navigate: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = document as any;

    if (!supportsViewTransitions() || prefersReducedMotion()) {
      navigate();
      return;
    }

    // Si ya hay una transición pendiente, la cerramos antes de abrir otra.
    pendingRef.current?.();
    pendingRef.current = null;

    document.documentElement.dataset.nav = direction;

    const transition = doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          pendingRef.current = resolve;
          navigate();
          // Red de seguridad: si la ruta no llega a cambiar (enlace al mismo
          // sitio, navegación cancelada), no dejamos la pantalla congelada.
          timeoutRef.current = setTimeout(() => {
            pendingRef.current = null;
            resolve();
          }, 600);
        })
    );

    const cleanup = () => {
      delete document.documentElement.dataset.nav;
    };
    transition.finished.then(cleanup, cleanup);
  }, []);

  const push = useCallback(
    (href: string) => run("push", () => router.push(href)),
    [router, run]
  );

  const replace = useCallback(
    (href: string) => run("push", () => router.replace(href)),
    [router, run]
  );

  const back = useCallback(() => run("pop", () => router.back()), [router, run]);

  // Intercepta los clics en enlaces internos para animarlos sin tener que
  // sustituir los <Link> de todas las páginas. Fase de captura para llegar
  // antes que el propio Link de Next.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.noTransition !== undefined) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Enlaces a la misma ruta (anclas, cambios de query que gestiona la
      // propia página) no llevan transición.
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      push(url.pathname + url.search + url.hash);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [push]);

  const value: NavContextValue = {
    push,
    replace,
    back,
    isTabRoot: TAB_ROOTS.includes(pathname),
  };

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error("useNav debe usarse dentro de <NavProvider>");
  }
  return ctx;
}
