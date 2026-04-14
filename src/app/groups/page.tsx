"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Avatar from "@/components/Avatar";
import ActivityFeed from "@/components/ActivityFeed";
import Footer from "@/components/Footer";
import PageLoader from "@/components/PageLoader";

interface GroupMemberPreview {
  user: { name: string | null; displayName: string | null; avatarUrl: string | null };
}

interface Group {
  id: string;
  name: string;
  pinned: boolean;
  _count: { members: number; games: number };
  members: GroupMemberPreview[];
}

interface RecentGame {
  gameId: number;
  gameName: string;
  thumbnail: string | null;
  groupId: string;
  groupName: string;
  date: string;
}

interface EventAttendeePreview {
  user: { name: string | null; displayName: string | null; avatarUrl: string | null };
}

interface UpcomingEvent {
  id: string;
  name: string;
  date: string;
  location: string | null;
  attendees: EventAttendeePreview[];
  _count: { attendees: number; games: number };
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupsRes, gamesRes, eventsRes] = await Promise.all([
          fetch("/api/groups", { credentials: "include" }),
          fetch("/api/profile/recent-games", { credentials: "include" }),
          fetch("/api/events", { credentials: "include" }),
        ]);

        if (!groupsRes.ok) throw new Error("Error al cargar los grupos");
        setGroups(await groupsRes.json());

        if (gamesRes.ok) setRecentGames(await gamesRes.json());
        if (eventsRes.ok) {
          const allEvents: UpcomingEvent[] = await eventsRes.json();
          setUpcomingEvents(allEvents.filter((e) => new Date(e.date) >= new Date()));
        }

        // Fetch activity feed
        const feedRes = await fetch("/api/feed?limit=10", { credentials: "include" });
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          setFeedItems(feedData.items);
          setFeedCursor(feedData.nextCursor);
          setFeedHasMore(!!feedData.nextCursor);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const loadMoreFeed = useCallback(async () => {
    if (!feedCursor || feedLoading) return;
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/feed?limit=10&cursor=${encodeURIComponent(feedCursor)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFeedItems((prev) => [...prev, ...data.items]);
        setFeedCursor(data.nextCursor);
        setFeedHasMore(!!data.nextCursor);
      }
    } finally {
      setFeedLoading(false);
    }
  }, [feedCursor, feedLoading]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-8 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Mis Grupos */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[var(--text)]">Mis Grupos</h2>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="group/card relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] transition-all duration-200 shadow-[var(--card-shadow)]"
                >
                  <Link
                    href={`/groups/${group.id}`}
                    prefetch={false}
                    className="block"
                  >
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                    {group.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-sm text-[var(--text-secondary)]">
                      <span>{group._count?.members || 0} miembros</span>
                      <span>{group._count?.games || 0} juegos</span>
                    </div>
                    {group.members?.length > 0 && (
                      <div className="flex -space-x-2">
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

          {/* Próximos Eventos */}
          {!loading && upcomingEvents.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--text)]">Próximos eventos</h2>
                <Link
                  href="/events"
                  prefetch={false}
                  className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
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
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] transition-all duration-200 block shadow-[var(--card-shadow)]"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--text)]">{event.name}</h3>
                      {event.attendees?.length > 0 && (
                        <div className="flex -space-x-2">
                          {event.attendees.slice(0, 4).map((a, i) => (
                            <Avatar
                              key={i}
                              name={a.user.displayName || a.user.name || "?"}
                              avatarUrl={a.user.avatarUrl}
                              size="xs"
                              className="ring-2 ring-[var(--surface)]"
                            />
                          ))}
                          {event._count.attendees > 4 && (
                            <div className="w-6 h-6 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[9px] text-[var(--text-secondary)] ring-2 ring-[var(--surface)] shrink-0">
                              +{event._count.attendees - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="text-xs text-[var(--primary)]">
                        {new Date(event.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {event.location && (
                        <span className="text-xs text-[var(--text-secondary)]">{event.location}</span>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        {event._count.attendees} asistente{event._count.attendees !== 1 ? "s" : ""} · {event._count.games} juego{event._count.games !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Actividad reciente */}
          {!loading && feedItems.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-[var(--text)] mb-4">Actividad reciente</h2>
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--card-shadow)]">
                <ActivityFeed
                  items={feedItems}
                  showContext
                  onLoadMore={loadMoreFeed}
                  hasMore={feedHasMore}
                  loading={feedLoading}
                />
              </div>
            </div>
          )}

          {/* Juegos Recientes */}
          {!loading && recentGames.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-[var(--text)] mb-4">Juegos recientes</h2>
              <div className="space-y-2">
                {recentGames.map((item, i) => (
                  <Link
                    key={`${item.groupId}-${item.gameId}-${i}`}
                    href={`/groups/${item.groupId}`}
                    prefetch={false}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex items-center gap-3 hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] transition-all duration-200 block shadow-[var(--card-shadow)]"
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.gameName}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[var(--surface-hover)] rounded-lg flex items-center justify-center text-[var(--text-muted)] text-xs">
                        ?
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text)] truncate">
                        {item.gameName}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] truncate">
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
      <Footer />
    </>
  );
}
