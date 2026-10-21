"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDateShort } from "@/lib/format";
import { displayName } from "@/lib/users";
import Alert from "@/components/ui/Alert";
import { Input, Select } from "@/components/ui/Field";
import { AdminHeader } from "../AdminUI";

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
      <AdminHeader
        title="Todos los eventos"
        lead={loading ? "Cargando…" : `${filtered.length} de ${events.length}`}
        action={
          <>
            <div className="w-56">
              <Input
                type="search"
                size="sm"
                aria-label="Buscar eventos"
                placeholder="Buscar por nombre o email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div>
              <Select size="sm" aria-label="Filtrar por fecha" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                <option value="all">Todos</option>
                <option value="upcoming">Próximos</option>
                <option value="past">Pasados</option>
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
                  <div>{displayName(e.createdBy, e.createdBy.email)}</div>
                  <div className="text-xs text-[var(--text-muted)]">{e.createdBy.email}</div>
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {e.attendees}{e.maxAttendees ? `/${e.maxAttendees}` : ""}
                </td>
                <td className="px-4 py-2 text-right font-mono">{e.games}</td>
                <td className="px-4 py-2 text-right text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {formatDateShort(e.date)}
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
