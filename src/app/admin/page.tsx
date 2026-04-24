"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatActivity } from "@/lib/activity";

interface Stats {
  totals: {
    users: number;
    groups: number;
    eventsPublic: number;
    eventsPrivate: number;
    games: number;
    votes: number;
    sessions: number;
  };
  activity: {
    users: { date: string; count: number }[];
    groups: { date: string; count: number }[];
    events: { date: string; count: number }[];
    votes: { date: string; count: number }[];
  };
  tops: {
    games: { groupGameId: string; gameName: string; thumbnail: string | null; groupId: string; groupName: string; votes: number }[];
    groups: { id: string; name: string; sessions: number; members: number; games: number }[];
    users: { id: string; name: string; email: string; avatarUrl: string | null; votes: number; sessions: number; score: number }[];
  };
  health: {
    otpsLast24h: number;
    recentActivity: {
      id: string;
      type: string;
      createdAt: string;
      userName: string;
      groupName: string | null;
      groupId: string | null;
      eventName: string | null;
      eventId: string | null;
      metadata: Record<string, unknown>;
    }[];
  };
}

function Sparkline({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-[2px] h-12">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 rounded-sm opacity-90 hover:opacity-100 transition-opacity"
          style={{
            height: `${Math.max(4, (d.count / max) * 100)}%`,
            background: color,
          }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-2xl font-display font-semibold" style={{ color: accent || "var(--text)" }}>{value}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(setStats)
      .catch(() => setError("No se pudieron cargar las estadísticas"));
  }, []);

  if (error) {
    return <div className="text-[var(--text-secondary)]">{error}</div>;
  }

  if (!stats) {
    return <div className="text-[var(--text-muted)] text-sm">Cargando estadísticas…</div>;
  }

  const totalSum =
    stats.activity.users.reduce((s, d) => s + d.count, 0) +
    stats.activity.groups.reduce((s, d) => s + d.count, 0) +
    stats.activity.events.reduce((s, d) => s + d.count, 0) +
    stats.activity.votes.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-display font-semibold">Resumen de la plataforma</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Datos agregados de toda la app.</p>
      </header>

      {/* Totales */}
      <section>
        <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Totales</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Usuarios" value={stats.totals.users} />
          <StatCard label="Grupos" value={stats.totals.groups} />
          <StatCard label="Eventos públicos" value={stats.totals.eventsPublic} />
          <StatCard label="Eventos privados" value={stats.totals.eventsPrivate} />
          <StatCard label="Juegos en caché" value={stats.totals.games} />
          <StatCard label="Votos emitidos" value={stats.totals.votes} />
          <StatCard label="Sesiones" value={stats.totals.sessions} />
        </div>
      </section>

      {/* Actividad reciente */}
      <section>
        <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">
          Últimos 30 días {totalSum > 0 && <span className="text-[var(--text-secondary)] normal-case">· {totalSum} eventos</span>}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Altas de usuario</span>
              <span className="text-sm font-medium">{stats.activity.users.reduce((s, d) => s + d.count, 0)}</span>
            </div>
            <Sparkline data={stats.activity.users} color="#a855f7" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Grupos creados</span>
              <span className="text-sm font-medium">{stats.activity.groups.reduce((s, d) => s + d.count, 0)}</span>
            </div>
            <Sparkline data={stats.activity.groups} color="#10b981" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Eventos creados</span>
              <span className="text-sm font-medium">{stats.activity.events.reduce((s, d) => s + d.count, 0)}</span>
            </div>
            <Sparkline data={stats.activity.events} color="#f59e0b" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Votos emitidos</span>
              <span className="text-sm font-medium">{stats.activity.votes.reduce((s, d) => s + d.count, 0)}</span>
            </div>
            <Sparkline data={stats.activity.votes} color="#ef4444" />
          </div>
        </div>
      </section>

      {/* Tops */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Top juegos</h3>
          {stats.tops.games.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Sin votos todavía.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {stats.tops.games.map((g, i) => (
                <li key={g!.groupGameId} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[var(--text-muted)] w-4 text-right">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{g!.gameName}</div>
                      <Link href={`/admin/groups/${g!.groupId}`} className="text-xs text-[var(--text-muted)] hover:text-purple-600 truncate block">
                        {g!.groupName}
                      </Link>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">{g!.votes} votos</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Grupos más activos</h3>
          {stats.tops.groups.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Aún sin sesiones.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {stats.tops.groups.map((g, i) => (
                <li key={g!.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[var(--text-muted)] w-4 text-right">{i + 1}</span>
                    <Link href={`/admin/groups/${g!.id}`} className="truncate font-medium hover:text-purple-600">
                      {g!.name}
                    </Link>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">{g!.sessions} ses.</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Usuarios más activos</h3>
          {stats.tops.users.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Sin actividad aún.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {stats.tops.users.map((u, i) => (
                <li key={u.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[var(--text-muted)] w-4 text-right">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{u.email}</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
                    {u.votes}v · {u.sessions}s
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Salud técnica */}
      <section>
        <h2 className="text-sm uppercase tracking-wide text-[var(--text-muted)] mb-3">Salud técnica</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StatCard label="OTP enviados (24h)" value={stats.health.otpsLast24h} />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Últimas 20 acciones (todas)</div>
          {stats.health.recentActivity.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Sin actividad reciente.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {stats.health.recentActivity.map((a) => (
                <li key={a.id} className="py-2 text-sm flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium">{a.userName}</span>{" "}
                    <span className="text-[var(--text-secondary)]">{formatActivity(a.type, a.metadata)}</span>
                    {a.groupName && (
                      <Link href={`/admin/groups/${a.groupId}`} className="text-xs text-[var(--text-muted)] hover:text-purple-600 ml-1">
                        · {a.groupName}
                      </Link>
                    )}
                    {a.eventName && (
                      <Link href={`/admin/events/${a.eventId}`} className="text-xs text-[var(--text-muted)] hover:text-purple-600 ml-1">
                        · {a.eventName}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
