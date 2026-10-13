"use client";

import { useEffect, useSyncExternalStore } from "react";
import { profileHref } from "@/lib/users";

// Lo que la cabecera necesita saber de quien navega. La navbar se monta de
// nuevo en cada página, así que esto vive fuera de ella (y en localStorage
// para las recargas): se pinta al momento con lo último conocido y se
// revalida por detrás, en vez de ir apareciendo trozos que empujan al resto.
export type NavUser = {
  /** Nombre a mostrar (displayName o nombre), para saludar. */
  name: string;
  bggUsername: string;
  isSuperadmin: boolean;
  profileHref: string;
};

// undefined = aún no se sabe; null = sin sesión
type NavUserState = NavUser | null | undefined;

const STORAGE_KEY = "bgp:nav-user";
// Con sesión conocida, no hace falta preguntar en cada cambio de página.
const FRESH_MS = 60_000;

const listeners = new Set<() => void>();
let state: NavUserState;
let hydrated = false;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;

function isNavUser(v: unknown): v is NavUser {
  const u = v as NavUser | null;
  return (
    !!u &&
    typeof u.name === "string" &&
    typeof u.bggUsername === "string" &&
    typeof u.isSuperadmin === "boolean" &&
    typeof u.profileHref === "string"
  );
}

function getSnapshot(): NavUserState {
  if (!hydrated) {
    hydrated = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : undefined;
      if (isNavUser(parsed)) state = parsed;
    } catch {
      // Safari privado o JSON roto: se pregunta al servidor y listo.
    }
  }
  return state;
}

function getServerSnapshot(): NavUserState {
  return undefined;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function setState(next: NavUserState) {
  state = next;
  hydrated = true;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // sin storage: se queda solo en memoria
  }
  listeners.forEach((l) => l());
}

/** Pide el perfil de nuevo (una sola petición aunque lo pidan varios). */
export function refreshNavUser(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetch("/api/profile?lite=1", { credentials: "include" })
    .then(async (res) => {
      if (res.status === 401) {
        setState(null);
      } else if (res.ok) {
        const data = await res.json();
        setState({
          name: data?.displayName || data?.name || "",
          bggUsername: data?.bggUsername || "",
          isSuperadmin: !!data?.isSuperadmin,
          profileHref: data?.id ? profileHref(data) : "/profile",
        });
      }
      // Otros errores o sin red: se queda lo que hubiera.
      fetchedAt = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Al cerrar sesión, para no pintar la cabecera de la cuenta anterior. */
export function clearNavUser() {
  fetchedAt = 0;
  setState(null);
}

export function useNavUser(): NavUserState {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Sin sesión conocida se pregunta siempre: puede que acabe de entrar.
    if (!getSnapshot() || Date.now() - fetchedAt > FRESH_MS) refreshNavUser();
  }, []);

  return user;
}
