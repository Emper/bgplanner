"use client";

import Link from "next/link";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import { spotlightMove } from "@/components/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getGroupType } from "@/lib/groupTypes";
import { displayName } from "@/lib/users";
import { plural } from "@/lib/text";

// La lista de tus grupos (la cabecera la pinta page.tsx). Llega ya con los
// grupos desde el servidor; aquí solo vive lo que cambia: fijar y desfijar.

interface GroupMemberPreview {
  user: { name: string | null; displayName: string | null; avatarUrl: string | null };
}

export interface GroupListItem {
  id: string;
  name: string;
  type: string;
  pinned: boolean;
  _count: { members: number; games: number };
  members: GroupMemberPreview[];
}

type Group = GroupListItem;

export default function GroupsList({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const toast = useToast();

  const togglePin = async (group: Group) => {
    const newPinned = !group.pinned;
    try {
      const res = await fetch(`/api/groups/${group.id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: newPinned }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error(newPinned ? "No se ha podido fijar el grupo" : "No se ha podido desfijar el grupo");
      return;
    }
    setGroups((prev) =>
      prev
        .map((g) => (g.id === group.id ? { ...g, pinned: newPinned } : g))
        .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
    );
  };

  return (
    <>
      {groups.length === 0 && (
        <EmptyState
          variant="card"
          icon="👥"
          title="No perteneces a ningún grupo todavía"
          description="¡Crea uno o acepta una invitación!"
          className="mb-8"
        />
      )}

      {groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 fx-stagger">
          {groups.map((group) => {
            const cfg = getGroupType(group.type);
            return (
              <div
                key={group.id}
                onPointerMove={spotlightMove}
                className="fx-spotlight group/card relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 transition-all duration-200 shadow-[var(--card-shadow)]"
              >
                <Link href={`/groups/${group.id}`} prefetch={false} className="block">
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-2 pr-9 truncate">{group.name}</h3>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--primary)]"
                        title={cfg.description}
                      >
                        <span aria-hidden>{cfg.emoji}</span>
                        <span className="font-medium">{cfg.label}</span>
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium">
                        {plural(group._count?.members || 0, "miembro", "miembros")}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium">
                        {plural(group._count?.games || 0, "juego", "juegos")}
                      </span>
                    </div>
                    {group.members?.length > 0 && (
                      <div className="flex -space-x-2 group-hover/card:-space-x-1 transition-all duration-300">
                        {group.members.slice(0, 4).map((m, i) => (
                          <Avatar
                            key={i}
                            name={displayName(m.user, "?")}
                            avatarUrl={m.user.avatarUrl}
                            size="xs"
                            className="ring-2 ring-[var(--surface)]"
                          />
                        ))}
                        {group._count.members > 4 && (
                          <div className="w-6 h-6 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[9px] text-[var(--text-secondary)] ring-2 ring-[var(--surface)] shrink-0">
                            +{group._count.members - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePin(group);
                  }}
                  aria-pressed={group.pinned}
                  aria-label={group.pinned ? "Desfijar" : "Fijar arriba"}
                  title={group.pinned ? "Desfijar" : "Fijar arriba"}
                  className={`absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg transition-all text-sm ${
                    group.pinned
                      ? "text-[var(--primary)] bg-[var(--accent-soft)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
                  }`}
                >
                  📌
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
