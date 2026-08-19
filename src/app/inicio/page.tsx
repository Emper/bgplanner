"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";
import ActivityFeed from "@/components/ActivityFeed";
import PullToRefresh from "@/components/PullToRefresh";

/**
 * Pantalla de Inicio: el aterrizaje de la app en móvil.
 *
 * Contesta lo que trae al usuario cuando abre la app —qué se juega pronto,
 * dónde falta que vote y qué han hecho los demás— con acciones directas, sin
 * obligar a entrar en cada grupo a buscarlo.
 */

type HomeData = {
  sessions: {
    id: string;
    name: string | null;
    date: string;
    playerCount: number;
    group: { id: string; name: string };
    games: { name: string; thumbnail: string | null }[];
  }[];
  events: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    imageUrl: string | null;
    _count: { attendees: number; games: number };
  }[];
  pendingVotes: { id: string; name: string; pending: number; total: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activity: any[];
  groupCount: number;
};

/** "hoy", "mañana", "sábado 4", "4 abr" */
function relativeDay(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(today)) / 86400000);

  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days > 1 && days < 7) {
    return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
  }
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function timeOf(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-display font-semibold text-[var(--text-secondary)] mb-2 px-1">
      {children}
    </h2>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-32 rounded-md bg-[var(--surface-hover)]" />
          <div className="h-24 rounded-2xl bg-[var(--surface-hover)]" />
        </div>
      ))}
    </div>
  );
}

export default function InicioPage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/home");
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError("");
    } catch {
      setError("No hemos podido cargar tu inicio. Inténtalo de nuevo.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const hasNothing =
    data &&
    data.sessions.length === 0 &&
    data.events.length === 0 &&
    data.pendingVotes.length === 0 &&
    data.activity.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <SmartNav />
      <PullToRefresh onRefresh={load}>
        <main className="flex-1 px-4 sm:px-6 py-5 max-w-3xl mx-auto w-full">
          {!data && !error && <Skeleton />}

          {error && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)]">
              {error}{" "}
              <button onClick={load} className="text-[var(--primary)] font-medium tap-auto">
                Reintentar
              </button>
            </div>
          )}

          {data && hasNothing && (
            <div className="text-center py-16">
              <p className="text-[var(--text-secondary)] mb-5">
                {data.groupCount === 0
                  ? "Todavía no estás en ningún grupo. Crea uno e invita a tu gente."
                  : "No hay nada pendiente ahora mismo. Todo en orden."}
              </p>
              <Link
                href={data.groupCount === 0 ? "/groups/new" : "/groups"}
                className="inline-flex px-5 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-text)] font-semibold text-sm"
              >
                {data.groupCount === 0 ? "Crear un grupo" : "Ver mis grupos"}
              </Link>
            </div>
          )}

          {data && !hasNothing && (
            <div className="space-y-7">
              {/* ── Próximas partidas ───────────────────────────────── */}
              {data.sessions.length > 0 && (
                <section>
                  <SectionTitle>Próximas partidas</SectionTitle>
                  <div className="space-y-2">
                    {data.sessions.map((s) => (
                      <Link
                        key={s.id}
                        href={`/groups/${s.group.id}?tab=sessions&session=${s.id}`}
                        className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--primary)] mb-0.5">
                              {relativeDay(s.date)} · {timeOf(s.date)}
                            </p>
                            <p className="font-display font-semibold text-[var(--text)] truncate">
                              {s.name || s.group.name}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                              {s.group.name} · {s.playerCount} jugadores
                              {s.games.length > 0 && ` · ${s.games.map((g) => g.name).join(", ")}`}
                            </p>
                          </div>
                          {s.games[0]?.thumbnail && (
                            <Image
                              src={s.games[0].thumbnail}
                              alt=""
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                            />
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Te falta votar ──────────────────────────────────── */}
              {data.pendingVotes.length > 0 && (
                <section>
                  <SectionTitle>Te falta votar</SectionTitle>
                  <div className="space-y-2">
                    {data.pendingVotes.map((g) => (
                      <Link
                        key={g.id}
                        href={`/groups/${g.id}?tab=ranking`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text)] truncate">{g.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {g.pending} de {g.total} juegos sin votar
                          </p>
                        </div>
                        <span className="shrink-0 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-text)] text-xs font-semibold">
                          Votar
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Próximos eventos ────────────────────────────────── */}
              {data.events.length > 0 && (
                <section>
                  <SectionTitle>Próximos eventos</SectionTitle>
                  <div className="space-y-2">
                    {data.events.map((e) => (
                      <Link
                        key={e.id}
                        href={`/events/${e.id}`}
                        className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)] p-4"
                      >
                        <p className="text-xs font-medium text-[var(--primary)] mb-0.5">
                          {relativeDay(e.date)} · {timeOf(e.date)}
                        </p>
                        <p className="font-display font-semibold text-[var(--text)] truncate">
                          {e.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                          {e._count.attendees} asistentes · {e._count.games} juegos
                          {e.location && ` · ${e.location}`}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Actividad ───────────────────────────────────────── */}
              {data.activity.length > 0 && (
                <section>
                  <SectionTitle>Lo último en tus grupos</SectionTitle>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)] p-4">
                    <ActivityFeed items={data.activity} showContext hasMore={false} loading={false} />
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </PullToRefresh>
      <Footer />
    </div>
  );
}
