"use client";

import { useSyncExternalStore } from "react";

// Lista de amigos de quien está mirando, compartida por toda la página: el
// botón de añadir puede salir veinte veces (miembros de un grupo, asistentes
// de un evento…) y la lista se pide una sola vez. Lo que se añade o se quita
// desde un botón se ve al momento en todos los demás.

export interface Friend {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  slug: string | null;
}

interface FriendsState {
  /** false hasta que llega la lista (o se sabe que no hay sesión). */
  loaded: boolean;
  /** Quien mira; null sin sesión. */
  me: string | null;
  friends: Friend[];
}

const EMPTY: FriendsState = { loaded: false, me: null, friends: [] };

let state: FriendsState = EMPTY;
let generation = 0;
const listeners = new Set<() => void>();

function setState(next: FriendsState) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  // Una respuesta que llega tarde (de una página anterior, o de antes de
  // entrar o salir de la cuenta) no pisa a la buena.
  const current = ++generation;
  fetch("/api/friends", { credentials: "include" })
    .then(async (res) => {
      if (current !== generation) return;
      if (!res.ok) {
        setState({ loaded: true, me: null, friends: [] });
        return;
      }
      const data: { userId: string; friends: Friend[] } = await res.json();
      if (current !== generation) return;
      setState({ loaded: true, me: data.userId, friends: data.friends });
    })
    .catch(() => {
      if (current === generation) setState({ ...state, loaded: true });
    });
}

function subscribe(listener: () => void) {
  // Se pide de nuevo cada vez que una página empieza a usarla: entrar o salir
  // de la cuenta navega sin recargar y la lista de antes ya no vale.
  if (listeners.size === 0) load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFriends(): FriendsState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

/** Añade al momento y deshace si el servidor dice que no. */
export async function addFriend(friend: Friend): Promise<boolean> {
  const prev = state;
  if (!prev.friends.some((f) => f.id === friend.id)) {
    setState({ ...prev, friends: [friend, ...prev.friends] });
  }
  try {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId: friend.id }),
    });
    if (!res.ok) throw new Error();
    // Nos quedamos con los datos del servidor, que pueden ser más frescos
    const data: { friend: Friend } = await res.json();
    setState({
      ...state,
      friends: state.friends.map((f) => (f.id === data.friend.id ? data.friend : f)),
    });
    return true;
  } catch {
    setState({ ...state, friends: state.friends.filter((f) => f.id !== friend.id) });
    return false;
  }
}

/** Quita al momento y lo devuelve a su sitio si falla. */
export async function removeFriend(friendId: string): Promise<boolean> {
  const index = state.friends.findIndex((f) => f.id === friendId);
  if (index === -1) return true;
  const removed = state.friends[index];
  setState({ ...state, friends: state.friends.filter((f) => f.id !== friendId) });
  try {
    const res = await fetch(`/api/friends/${encodeURIComponent(friendId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error();
    return true;
  } catch {
    if (!state.friends.some((f) => f.id === friendId)) {
      const friends = [...state.friends];
      friends.splice(Math.min(index, friends.length), 0, removed);
      setState({ ...state, friends });
    }
    return false;
  }
}

/** Se queda solo con lo que la lista de amigos necesita (nada de email). */
export function toFriend(user: Friend): Friend {
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    slug: user.slug,
  };
}
