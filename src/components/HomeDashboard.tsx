"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Avatar from "@/components/Avatar";
import ActivityFeed from "@/components/ActivityFeed";
import Footer from "@/components/Footer";
import PageLoader from "@/components/PageLoader";
import DateTile from "@/components/DateTile";
import { CountUp } from "@/components/motion";
import { getGroupType } from "@/lib/groupTypes";
import { useFriends } from "@/lib/friends";
import { profileHref } from "@/lib/users";

// La portada de quien tiene cuenta (la pinta / cuando hay sesión). En escritorio, una barra lateral con
// accesos directos (grupos › eventos › amigos) y a la derecha lo que se mueve:
// los últimos juegos y la actividad. En el móvil la barra se convierte en
// tiras horizontales encima del feed.

interface Group {
  id: string;
  name: string;
  type: string;
  pinned: boolean;
  _count: { members: number; games: number };
}

interface RecentGame {
  gameId: number;
  gameName: string;
  thumbnail: string | null;
  image: string | null;
  groupId: string;
  groupName: string;
  date: string;
}

interface UpcomingEvent {
  id: string;
  name: string;
  date: string;
  location: string | null;
  myStatus: string | null;
  _count: { attendees: number; games: number };
}

// «Buenos días» a las 9 y «buenas noches» a las 23: la app se usa mucho
// de noche, que es cuando se queda para jugar.
function greeting() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Buenos días";
  if (h >= 14 && h < 21) return "Buenas tardes";
  return "Buenas noches";
}

function daysUntil(date: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86_400_000);
}

function whenLabel(date: string) {
  const days = daysUntil(date);
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  if (days < 7) return `el ${new Date(date).toLocaleDateString("es-ES", { weekday: "long" })}`;
  return `en ${days} días`;
}

const isGoing = (e: UpcomingEvent) => !!e.myStatus && e.myStatus !== "cancelled";

const SIDEBAR_GROUPS = 8;
const SIDEBAR_EVENTS = 4;

// ── Barra lateral ─────────────────────────────────────────────────────────

function SideSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="lg:pt-5 lg:first:pt-0 lg:border-t lg:first:border-t-0 lg:border-[var(--border)]">
      <div className="flex items-center justify-between mb-2.5 lg:mb-2 lg:px-2">
        <h2 className="text-lg lg:text-xs font-bold lg:font-semibold lg:uppercase lg:tracking-wider text-[var(--text)] lg:text-[var(--text-muted)]">
          {title}
          {count ? (
            <span className="ml-1.5 text-sm lg:text-xs font-medium text-[var(--text-muted)]">{count}</span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// En el móvil, tira horizontal con scroll; en escritorio, lista vertical.
const SIDE_LIST =
  "flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0 lg:flex-col lg:gap-0.5 lg:overflow-visible";

const SIDE_ITEM =
  "shrink-0 rounded-2xl lg:rounded-xl border border-[var(--border)] lg:border-transparent bg-[var(--surface)] lg:bg-transparent shadow-[var(--card-shadow)] lg:shadow-none hover:border-[var(--primary)]/30 lg:hover:border-transparent lg:hover:bg-[var(--surface-hover)] transition-all duration-200";

function SideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
    >
      {children}
    </Link>
  );
}

function SideEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm lg:text-xs text-[var(--text-secondary)] lg:text-[var(--text-muted)] bg-[var(--surface)] lg:bg-transparent rounded-2xl border border-dashed border-[var(--border)] lg:border-0 px-4 py-3 lg:px-2 lg:py-1">
      {children}
    </p>
  );
}

function GroupsSection({ groups }: { groups: Group[] }) {
  return (
    <SideSection
      title="Grupos"
      action={
        <div className="flex items-center gap-3">
          {groups.length > SIDEBAR_GROUPS && <SideLink href="/groups">Ver todos</SideLink>}
          <SideLink href="/groups/new">+ Crear</SideLink>
        </div>
      }
    >
      {groups.length === 0 ? (
        <SideEmpty>Aún no estás en ningún grupo. Crea uno o acepta una invitación.</SideEmpty>
      ) : (
        <div className={SIDE_LIST}>
          {groups.slice(0, SIDEBAR_GROUPS).map((group) => {
            const cfg = getGroupType(group.type);
            return (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                prefetch={false}
                title={group.name}
                className={`${SIDE_ITEM} w-40 lg:w-auto p-3 lg:px-2 lg:py-1.5 flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-3`}
              >
                <span
                  className="w-9 h-9 shrink-0 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-lg"
                  title={cfg.label}
                >
                  {cfg.emoji}
                </span>
                <span className="min-w-0 w-full lg:flex-1">
                  <span className="block text-sm font-semibold lg:font-medium text-[var(--text)] truncate">
                    {group.name}
                  </span>
                  <span className="block text-[11px] text-[var(--text-muted)] truncate">
                    {group._count.games} {group._count.games === 1 ? "juego" : "juegos"} · {group._count.members}{" "}
                    {group._count.members === 1 ? "miembro" : "miembros"}
                  </span>
                </span>
                {group.pinned && (
                  <span className="hidden lg:inline text-xs" title="Fijado">📌</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </SideSection>
  );
}

function EventsSection({ events }: { events: UpcomingEvent[] }) {
  return (
    <SideSection
      title="Eventos"
      action={
        <div className="flex items-center gap-3">
          <SideLink href="/events">Ver todos</SideLink>
          <SideLink href="/events/new">+ Crear</SideLink>
        </div>
      }
    >
      {events.length === 0 ? (
        <SideEmpty>Nada en el calendario. ¿Montas una quedada?</SideEmpty>
      ) : (
        <div className={SIDE_LIST}>
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              prefetch={false}
              title={event.name}
              className={`${SIDE_ITEM} w-56 lg:w-auto p-3 lg:px-2 lg:py-1.5 flex items-center gap-3`}
            >
              <DateTile date={event.date} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold lg:font-medium text-[var(--text)] truncate">
                  {event.name}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] mt-0.5">
                  <span className="font-semibold text-[var(--primary)] first-letter:uppercase">
                    {whenLabel(event.date)}
                  </span>
                  {isGoing(event) ? (
                    <span className="px-1.5 py-px rounded bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 font-medium">
                      {event.myStatus === "maybe" ? "Quizás" : "Vas"}
                    </span>
                  ) : (
                    <span className="px-1.5 py-px rounded bg-[var(--surface-hover)] text-[var(--text-muted)] font-medium">
                      Abierto
                    </span>
                  )}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </SideSection>
  );
}

function FriendsSection() {
  const { loaded, friends } = useFriends();
  if (!loaded) return null;
  return (
    <SideSection title="Amigos" count={friends.length}>
      {friends.length === 0 ? (
        <SideEmpty>
          🤝 Añade amigos desde su perfil o desde los miembros de tus grupos y eventos, y los tendrás aquí a un toque.
        </SideEmpty>
      ) : (
        <div className={SIDE_LIST}>
          {friends.map((friend) => {
            const name = friend.displayName || friend.name || "Jugador";
            return (
              <Link
                key={friend.id}
                href={profileHref(friend)}
                prefetch={false}
                title={name}
                className="group/friend shrink-0 w-[4.5rem] lg:w-auto flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3 p-1 lg:px-2 lg:py-1.5 rounded-2xl lg:rounded-xl lg:hover:bg-[var(--surface-hover)] transition-all duration-200"
              >
                <Avatar
                  name={name}
                  avatarUrl={friend.avatarUrl}
                  size="lg"
                  className="ring-2 ring-[var(--border)] group-hover/friend:ring-[var(--primary)]/50 transition-all lg:w-9 lg:h-9 lg:text-sm lg:ring-0"
                />
                <span className="w-full lg:flex-1 min-w-0 text-center lg:text-left text-xs lg:text-sm font-medium text-[var(--text-secondary)] lg:text-[var(--text)] truncate">
                  <span className="lg:hidden">{name.trim().split(/\s+/)[0]}</span>
                  <span className="hidden lg:inline">{name}</span>
                </span>
                <span className="hidden lg:inline text-[var(--text-muted)] opacity-0 group-hover/friend:opacity-100 transition-opacity" aria-hidden>
                  →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </SideSection>
  );
}

// ── Juegos recientes: tarjetones con la caja ──────────────────────────────

function RecentGameCard({ item }: { item: RecentGame }) {
  const img = item.image || item.thumbnail;
  return (
    <Link
      href={`/groups/${item.groupId}`}
      prefetch={false}
      title={`${item.gameName} · ${item.groupName}`}
      className="group/game relative shrink-0 snap-start w-32 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-hover)] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-1 transition-all duration-300"
    >
      {img ? (
        <Image
          src={img}
          alt={item.gameName}
          fill
          sizes="144px"
          className="object-cover transition-transform duration-500 group-hover/game:scale-105"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-4xl">🎲</span>
      )}
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
      <span className="absolute inset-x-0 bottom-0 p-2.5">
        <span className="block text-[13px] font-bold leading-tight text-white line-clamp-2 drop-shadow">
          {item.gameName}
        </span>
        <span className="block mt-0.5 text-[10px] text-white/70 truncate">{item.groupName}</span>
      </span>
    </Link>
  );
}

// ── Página ────────────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupsRes, gamesRes, eventsRes, profileRes, feedRes] = await Promise.all([
          fetch("/api/groups", { credentials: "include" }),
          fetch("/api/profile/recent-games", { credentials: "include" }),
          fetch("/api/events", { credentials: "include" }),
          fetch("/api/profile", { credentials: "include" }),
          fetch("/api/feed?limit=10", { credentials: "include" }),
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          const name: string = profile.displayName || profile.name || "";
          setFirstName(name.trim().split(/\s+/)[0] || null);
        }

        if (!groupsRes.ok) throw new Error("Error al cargar tu inicio");
        setGroups(await groupsRes.json());

        if (gamesRes.ok) setRecentGames(await gamesRes.json());
        if (eventsRes.ok) {
          const allEvents: UpcomingEvent[] = await eventsRes.json();
          const now = new Date();
          setUpcomingEvents(
            allEvents
              .filter((e) => new Date(e.date) >= now)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          );
        }

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
        // Deduplicamos por id: en dev (Strict Mode) y bajo razas el efecto
        // de auto-carga puede disparar la misma página dos veces.
        setFeedItems((prev) => {
          const seen = new Set(prev.map((i: { id: string }) => i.id));
          return [...prev, ...data.items.filter((i: { id: string }) => !seen.has(i.id))];
        });
        setFeedCursor(data.nextCursor);
        setFeedHasMore(!!data.nextCursor);
      }
    } finally {
      setFeedLoading(false);
    }
  }, [feedCursor, feedLoading]);

  // Primero a los que vas; los abiertos, después y si queda hueco
  const myEvents = upcomingEvents.filter(isGoing);
  const sidebarEvents = [...myEvents, ...upcomingEvents.filter((e) => !isGoing(e))].slice(0, SIDEBAR_EVENTS);
  const nextEvent = myEvents[0] ?? null;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-6 sm:py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {loading && <PageLoader withNavbar />}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && (
            <>
              {/* Saludo: lo primero que ves al entrar, con lo que tienes por delante */}
              <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 sm:px-8 sm:py-8 mb-6 shadow-[var(--card-shadow)]">
                <div className="absolute inset-0 fx-dots opacity-60 pointer-events-none" aria-hidden />
                <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[var(--glow)] blur-[70px] pointer-events-none" aria-hidden />
                <div className="relative">
                  <p className="text-sm font-medium text-[var(--text-muted)]">
                    {greeting()}{firstName ? `, ${firstName}` : ""} 👋
                  </p>
                  <h1 className="mt-1 text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--text)]">
                    {nextEvent ? (
                      <Link href={`/events/${nextEvent.id}`} prefetch={false} className="hover:opacity-90 transition-opacity">
                        <span className="text-[var(--primary)]">{nextEvent.name}</span>{" "}
                        es {whenLabel(nextEvent.date)}
                      </Link>
                    ) : (
                      <>
                        ¿A qué jugamos{" "}
                        <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
                          esta semana?
                        </span>
                      </>
                    )}
                  </h1>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)]">
                      👥 <CountUp value={groups.length} /> {groups.length === 1 ? "grupo" : "grupos"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)]">
                      🎲 <CountUp value={groups.reduce((n, g) => n + (g._count?.games || 0), 0)} /> juegos en tus mesas
                    </span>
                    {/* Sin eventos a la vista, mejor no presumir de un cero */}
                    {myEvents.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)]">
                        📅 <CountUp value={myEvents.length} /> {myEvents.length === 1 ? "evento próximo" : "eventos próximos"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:gap-6 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
                {/* Accesos directos */}
                <aside className="min-w-0 space-y-7 lg:space-y-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto no-scrollbar lg:bg-[var(--surface)] lg:rounded-2xl lg:border lg:border-[var(--border)] lg:p-3 lg:shadow-[var(--card-shadow)]">
                  <GroupsSection groups={groups} />
                  <EventsSection events={sidebarEvents} />
                  <FriendsSection />
                </aside>

                <div className="min-w-0 space-y-8">
                  {/* Juegos recientes */}
                  {recentGames.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold text-[var(--text)] mb-3">Juegos recientes</h2>
                      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pt-1 pb-2">
                        {recentGames.map((item) => (
                          <RecentGameCard key={`${item.groupId}-${item.gameId}`} item={item} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Actividad reciente */}
                  <section>
                    <h2 className="text-xl font-bold text-[var(--text)] mb-3">Actividad reciente</h2>
                    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--card-shadow)]">
                      <ActivityFeed
                        items={feedItems}
                        showContext
                        onLoadMore={loadMoreFeed}
                        hasMore={feedHasMore}
                        loading={feedLoading}
                      />
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
