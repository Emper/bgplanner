"use client";

import { useState } from "react";
import { addFriend, removeFriend, useFriends, type Friend } from "@/lib/friends";

interface Props {
  /** A quién se añade. Con sus datos para que salga ya en la lista de amigos. */
  user: Friend;
  /** "pill" para el perfil; "compact" para las filas de miembros y asistentes. */
  variant?: "pill" | "compact";
  className?: string;
}

/**
 * Añadir o quitar de amigos con un clic. Se puede poner en cualquier sitio:
 * no se pinta sin sesión, ni en uno mismo, ni hasta saber si ya es amigo.
 */
export default function FriendButton({ user, variant = "compact", className = "" }: Props) {
  const { loaded, me, friends } = useFriends();
  const [busy, setBusy] = useState(false);

  if (!loaded || !me || me === user.id) return null;

  const isFriend = friends.some((f) => f.id === user.id);
  const name = user.displayName || user.name || "este jugador";

  const toggle = async (e: React.MouseEvent) => {
    // Suele ir dentro de filas con enlaces: que el clic no navegue
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (isFriend && !confirm(`¿Quitar a ${name} de tus amigos?`)) return;
    setBusy(true);
    const ok = isFriend ? await removeFriend(user.id) : await addFriend(user);
    setBusy(false);
    if (!ok) alert(isFriend ? "No se ha podido quitar de tus amigos" : "No se ha podido añadir a tus amigos");
  };

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={isFriend ? "Quitar de amigos" : `Añadir a ${name} a tus amigos`}
        className={`group/friend inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-60 ${
          isFriend
            ? "bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
            : "bg-[var(--primary)] text-[var(--primary-text)] hover:bg-[var(--primary-hover)] shadow-sm hover:shadow-md"
        } ${className}`}
      >
        {isFriend ? (
          <>
            <span className="group-hover/friend:hidden">✓ Amigos</span>
            <span className="hidden group-hover/friend:inline">Quitar de amigos</span>
          </>
        ) : (
          <>+ Añadir a amigos</>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={isFriend ? `Quitar a ${name} de tus amigos` : `Añadir a ${name} a tus amigos`}
      className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-60 ${
        isFriend
          ? "bg-[var(--accent-soft)] text-[var(--primary)] hover:bg-red-500/10 hover:text-red-400"
          : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--primary)]"
      } ${className}`}
    >
      {isFriend ? "✓ Amigo" : "+ Amigo"}
    </button>
  );
}
