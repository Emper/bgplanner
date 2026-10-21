"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDateShort } from "@/lib/format";
import { displayName } from "@/lib/users";
import Alert from "@/components/ui/Alert";
import { Input, Select } from "@/components/ui/Field";
import { AdminHeader } from "../AdminUI";

interface AdminGroup {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  members: number;
  games: number;
  nights: number;
}

type SortKey = "createdAt" | "name" | "members" | "games" | "nights";

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
        case "nights":
          return b.nights - a.nights;
        case "createdAt":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [groups, query, sort]);

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Todos los grupos"
        lead={loading ? "Cargando…" : `${filtered.length} de ${groups.length}`}
        action={
          <>
            <div className="w-56">
              <Input
                type="search"
                size="sm"
                aria-label="Buscar grupos"
                placeholder="Buscar por nombre o email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div>
              <Select size="sm" aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="createdAt">Más recientes</option>
                <option value="name">Nombre</option>
                <option value="members">Más miembros</option>
                <option value="games">Más juegos</option>
                <option value="nights">Más sesiones</option>
              </Select>
            </div>
          </>
        }
      />

      {error && <Alert>{error}</Alert>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
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
                  <div>{displayName(g.owner, g.owner.email)}</div>
                  <div className="text-xs text-[var(--text-muted)]">{g.owner.email}</div>
                </td>
                <td className="px-4 py-2 text-right font-mono">{g.members}</td>
                <td className="px-4 py-2 text-right font-mono">{g.games}</td>
                <td className="px-4 py-2 text-right font-mono">{g.nights}</td>
                <td className="px-4 py-2 text-right text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {formatDateShort(g.createdAt)}
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
