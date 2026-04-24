"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface AdminEvent {
  id: string;
  name: string;
  visibility: "public" | "private";
  date: string;
  endDate: string | null;
  location: string | null;
  maxAttendees: number | null;
  attendees: number;
  games: number;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

type Filter = "all" | "upcoming" | "past";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [now] = useState<number>(() => Date.now());

  useEffect(() => {
    fetch("/api/admin/events")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setEvents)
      .catch(() => setError("No se pudieron cargar los eventos"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q) && !e.createdBy.email.toLowerCase().includes(q)) {
        return false;
      }
      if (filter !== "all") {
        const ts = new Date(e.date).getTime();
        if (filter === "upcoming" && ts < now) return false;
        if (filter === "past" && ts >= now) return false;
      }
      return true;
    });
  }, [events, query, filter, now]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Todos los eventos</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {loading ? "Cargando…" : `${filtered.length} de ${events.length}`}
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
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="px-3 py-2 rounded-xl text-sm bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-purple-500 focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="upcoming">Próximos</option>
            <option value="past">Pasados</option>
          </select>
        </div>
      </header>

      {error && <div className="text-sm text-[var(--color-danger,#ef4444)]">{error}</div>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-alt)] text-[var(--text-secondary)] uppercase text-xs tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Evento</th>
              <th className="text-left px-4 py-2">Visibilidad</th>
              <th className="text-left px-4 py-2">Creado por</th>
              <th className="text-right px-4 py-2">Asistentes</th>
              <th className="text-right px-4 py-2">Juegos</th>
              <th className="text-right px-4 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.id}
                className="border-t border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="font-medium hover:text-purple-600"
                  >
                    {e.name}
                  </Link>
                  {e.location && (
                    <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{e.location}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  {e.visibility === "private" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300">
                      Privado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                      Público
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div>{e.createdBy.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{e.createdBy.email}</div>
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {e.attendees}{e.maxAttendees ? `/${e.maxAttendees}` : ""}
                </td>
                <td className="px-4 py-2 text-right font-mono">{e.games}</td>
                <td className="px-4 py-2 text-right text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {new Date(e.date).toLocaleDateString("es-ES", {
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
