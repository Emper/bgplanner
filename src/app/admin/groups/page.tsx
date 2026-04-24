"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface AdminGroup {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  members: number;
  games: number;
  sessions: number;
}

type SortKey = "createdAt" | "name" | "members" | "games" | "sessions";

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("createdAt");

  useEffect(() => {
    fetch("/api/admin/groups")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setGroups(data))
      .catch(() => setError("No se pudieron cargar los grupos"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? groups.filter(
          (g) => g.name.toLowerCase().includes(q) || g.owner.email.toLowerCase().includes(q)
        )
      : groups;
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "members":
          return b.members - a.members;
        case "games":
          return b.games - a.games;
        case "sessions":
          return b.sessions - a.sessions;
        case "createdAt":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [groups, query, sort]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Todos los grupos</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {loading ? "Cargando…" : `${filtered.length} de ${groups.length}`}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Buscar por nombre o email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none w-56"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-3 py-2 rounded-xl text-sm bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none"
          >
            <option value="createdAt">Más recientes</option>
            <option value="name">Nombre</option>
            <option value="members">Más miembros</option>
            <option value="games">Más juegos</option>
            <option value="sessions">Más sesiones</option>
          </select>
        </div>
      </header>

      {error && <div className="text-sm text-[var(--color-danger,#ef4444)]">{error}</div>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-alt)] text-[var(--text-secondary)] uppercase text-xs tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Grupo</th>
              <th className="text-left px-4 py-2">Owner</th>
              <th className="text-right px-4 py-2">Miembros</th>
              <th className="text-right px-4 py-2">Juegos</th>
              <th className="text-right px-4 py-2">Sesiones</th>
              <th className="text-right px-4 py-2">Creado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr
                key={g.id}
                className="border-t border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/groups/${g.id}`}
                    className="font-medium hover:text-purple-600"
                  >
                    {g.name}
                  </Link>
                  <div className="text-xs text-[var(--text-muted)]">{g.type}</div>
                </td>
                <td className="px-4 py-2">
                  <div>{g.owner.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{g.owner.email}</div>
                </td>
                <td className="px-4 py-2 text-right font-mono">{g.members}</td>
                <td className="px-4 py-2 text-right font-mono">{g.games}</td>
                <td className="px-4 py-2 text-right font-mono">{g.sessions}</td>
                <td className="px-4 py-2 text-right text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {new Date(g.createdAt).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
