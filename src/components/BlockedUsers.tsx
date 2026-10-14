"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { unblockUser } from "./Moderation";
import { profileHref } from "@/lib/users";

interface BlockedUser {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  slug: string | null;
}

/** Bloque del perfil con la gente que has bloqueado, para desbloquearla. */
export default function BlockedUsers() {
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/blocks")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsers(data?.blocked ?? []))
      .catch(() => setUsers([]));
  }, []);

  const unblock = async (id: string) => {
    setBusy(id);
    const ok = await unblockUser(id);
    setBusy(null);
    if (ok) setUsers((prev) => (prev ?? []).filter((u) => u.id !== id));
    else alert("No se ha podido desbloquear");
  };

  if (users === null) return null;

  return (
    <div className="mt-6 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--card-shadow)]">
      <h2 className="text-base font-semibold text-[var(--text)] mb-1">Usuarios bloqueados</h2>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
        No ves sus mensajes en la Comunidad, no te llegan sus avisos y no pueden añadirte a amigos.
        Se bloquea desde su perfil o desde el menú ⋯ de sus mensajes.
      </p>
      {users.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No has bloqueado a nadie. ¡Buen rollo! 🎲</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {users.map((u) => {
            const name = u.displayName || u.name || "Jugador";
            return (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <Link href={profileHref(u)} className="flex items-center gap-3 min-w-0 flex-1 group">
                  <Avatar name={name} avatarUrl={u.avatarUrl} size="sm" />
                  <span className="truncate text-sm font-medium text-[var(--text)] group-hover:text-[var(--primary)] transition-colors">
                    {name}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => unblock(u.id)}
                  disabled={busy === u.id}
                  className="shrink-0 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50 transition-all duration-200 disabled:opacity-60"
                >
                  {busy === u.id ? "…" : "Desbloquear"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
