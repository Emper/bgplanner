"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

interface Group {
  id: string;
  name: string;
  _count: { members: number; games: number };
}

interface RecentGame {
  gameId: number;
  gameName: string;
  thumbnail: string | null;
  groupId: string;
  groupName: string;
  date: string;
}

interface UpcomingEvent {
  id: string;
  name: string;
  date: string;
  location: string | null;
  _count: { attendees: number; games: number };
}

interface Profile {
  bggUsername: string | null;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupsRes, gamesRes, profileRes, eventsRes] = await Promise.all([
          fetch("/api/groups", { credentials: "include" }),
          fetch("/api/profile/recent-games", { credentials: "include" }),
          fetch("/api/profile", { credentials: "include" }),
          fetch("/api/events", { credentials: "include" }),
        ]);

        if (!groupsRes.ok) throw new Error("Error al cargar los grupos");
        setGroups(await groupsRes.json());

        if (gamesRes.ok) setRecentGames(await gamesRes.json());
        if (profileRes.ok) setProfile(await profileRes.json());
        if (eventsRes.ok) {
          const allEvents: UpcomingEvent[] = await eventsRes.json();
          setUpcomingEvents(allEvents.filter((e) => new Date(e.date) >= new Date()));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-900 py-8 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Banner BGG */}
          {profile?.bggUsername && (
            <a
              href={`https://boardgamegeek.com/user/${profile.bggUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-6 bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4 hover:border-amber-500/50 transition-colors block"
            >
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 font-bold text-lg">
                B
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400">Tu perfil en BoardGameGeek</p>
                <p className="text-amber-400 font-medium">@{profile.bggUsername}</p>
              </div>
              <span className="text-slate-500 text-xl">&rarr;</span>
            </a>
          )}

          {/* Mis Grupos */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-100">Mis Grupos</h2>
            <Link
              href="/groups/new"
              prefetch={false}
              className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 font-medium text-sm"
            >
              Crear grupo
            </Link>
          </div>

          {loading && <p className="text-slate-500">Cargando...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && groups.length === 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center text-slate-400 mb-8">
              No perteneces a ningún grupo todavía. ¡Crea uno o acepta una invitación!
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  prefetch={false}
                  className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-amber-500/50 transition-colors block"
                >
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">
                    {group.name}
                  </h3>
                  <div className="flex gap-4 text-sm text-slate-400">
                    <span>{group._count?.members || 0} miembros</span>
                    <span>{group._count?.games || 0} juegos</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Próximos Eventos */}
          {!loading && upcomingEvents.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-100">Próximos eventos</h2>
                <Link
                  href="/events"
                  prefetch={false}
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Ver todos
                </Link>
              </div>
              <div className="space-y-2">
                {upcomingEvents.slice(0, 3).map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    prefetch={false}
                    className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-amber-500/50 transition-colors block"
                  >
                    <h3 className="font-semibold text-slate-100">{event.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="text-xs text-amber-300">
                        {new Date(event.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {event.location && (
                        <span className="text-xs text-slate-400">{event.location}</span>
                      )}
                      <span className="text-xs text-slate-500">
                        {event._count.attendees} asistente{event._count.attendees !== 1 ? "s" : ""} · {event._count.games} juego{event._count.games !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Juegos Recientes */}
          {!loading && recentGames.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-slate-100 mb-4">Juegos recientes</h2>
              <div className="space-y-2">
                {recentGames.map((item, i) => (
                  <Link
                    key={`${item.groupId}-${item.gameId}-${i}`}
                    href={`/groups/${item.groupId}`}
                    prefetch={false}
                    className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 hover:border-amber-500/50 transition-colors block"
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.gameName}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center text-slate-500 text-xs">
                        ?
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-100 truncate">
                        {item.gameName}
                      </p>
                      <p className="text-sm text-slate-400 truncate">
                        en {item.groupName}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
