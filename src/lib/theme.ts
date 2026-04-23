"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const THEME_CHANGE_EVENT = "bgp:theme-change";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function subscribeTheme(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === "theme") callback();
  };
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  mq.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    mq.removeEventListener("change", callback);
  };
}

function getThemeSnapshot(): Theme {
  return (localStorage.getItem("theme") as Theme | null) || "system";
}

function getServerThemeSnapshot(): Theme {
  return "system";
}

const NOOP_SUBSCRIBE = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );
  const mounted = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    getMountedClient,
    getMountedServer
  );

  useEffect(() => {
    if (mounted) applyTheme(theme);
  }, [theme, mounted]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("theme", t);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(
    (e?: React.MouseEvent) => {
      const resolved = theme === "system" ? getSystemTheme() : theme;
      const next: Theme = resolved === "dark" ? "light" : "dark";

      // View Transitions API con animación de revelado circular
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = document as any;
      if (
        !doc.startViewTransition ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setTheme(next);
        return;
      }

      const x = e?.clientX ?? window.innerWidth / 2;
      const y = e?.clientY ?? 0;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = doc.startViewTransition(() => {
        setTheme(next);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 500,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    },
    [theme, setTheme]
  );

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? getSystemTheme() : theme;

  return { theme, resolvedTheme, setTheme, toggleTheme, mounted };
}
