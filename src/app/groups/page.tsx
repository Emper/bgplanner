"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Avatar from "@/components/Avatar";
import Footer from "@/components/Footer";
import PageLoader from "@/components/PageLoader";
import { spotlightMove } from "@/components/motion";
import { getGroupType } from "@/lib/groupTypes";

// Todos tus grupos. La portada con la actividad vive en /home.

interface GroupMemberPreview {
  user: { name: string | null; displayName: string | null; avatarUrl: string | null };
}

interface Group {
  id: string;
  name: string;
  type: string;
  pinned: boolean;
  _count: { members: number; games: number };
  members: GroupMemberPreview[];
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/groups", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Error al cargar los grupos");
        setGroups(await res.json());
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error inesperado"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-[var(--text)]">Mis Grupos</h1>
            <Link
              href="/groups/new"
              prefetch={false}
              className="px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Crear grupo
            </Link>
          </div>

          {loading && <PageLoader withNavbar />}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && groups.length === 0 && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 text-center text-[var(--text-secondary)] mb-8 shadow-[var(--card-shadow)]">
              No perteneces a ningún grupo todavía. ¡Crea uno o acepta una invitación!
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 fx-stagger">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onPointerMove={spotlightMove}
                  className="fx-spotlight group/card relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 transition-all duration-200 shadow-[var(--card-shadow)]"
                >
                  <Link
                    href={`/groups/${group.id}`}
                    prefetch={false}
                    className="block"
                  >
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-2 pr-9 truncate">
                    {group.name}
                  </h3>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {(() => {
                        const cfg = getGroupType(group.type);
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--primary)]"
                            title={cfg.description}
                          >
                            <span>{cfg.emoji}</span>
                            <span className="font-medium">{cfg.label}</span>
                          </span>
                        );
                      })()}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                        {group._count?.members || 0} {group._count?.members === 1 ? "miembro" : "miembros"}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                        {group._count?.games || 0} {group._count?.games === 1 ? "juego" : "juegos"}
                      </span>
                    </div>
                    {group.members?.length > 0 && (
                      <div className="flex -space-x-2 group-hover/card:-space-x-1 transition-all duration-300">
                        {group.members.slice(0, 4).map((m, i) => (
                          <Avatar
                            key={i}
                            name={m.user.displayName || m.user.name || "?"}
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
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newPinned = !group.pinned;
                      await fetch(`/api/groups/${group.id}/pin`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pinned: newPinned }),
                      });
                      setGroups((prev) =>
                        prev
                          .map((g) => g.id === group.id ? { ...g, pinned: newPinned } : g)
                          .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
                      );
                    }}
                    className={`absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg transition-all text-sm ${
                      group.pinned
                        ? "text-[var(--primary)] bg-[var(--accent-soft)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] opacity-0 group-hover/card:opacity-100"
                    }`}
                    title={group.pinned ? "Desfijar" : "Fijar arriba"}
                  >
                    📌
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
