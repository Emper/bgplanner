"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Avatar from "@/components/Avatar";
import PageLoader from "@/components/PageLoader";
import ActivityFeed from "@/components/ActivityFeed";
import GameShelf, { type ShelfGame } from "@/components/GameShelf";
import { formatDateShort } from "@/lib/format";
import { getGroupType } from "@/lib/groupTypes";

interface ProfileEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  imageUrl: string | null;
  visibility: string;
  isOrganizer: boolean;
  status: string;
  attendeeCount: number;
  gameCount: number;
}

interface ActivityItem {
  id: string;
  type: string;
  scope: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    bggUsername?: string | null;
  };
  group?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
}

interface PublicProfile {
  id: string;
  slug: string;
  displayName: string;
  location: string | null;
  bggUsername: string | null;
  avatarUrl: string | null;
  memberSince: string;
  isSelf: boolean;
  sharedGroups: { id: string; name: string; type: string }[];
  showcase: ShelfGame[];
  upcomingEvents: ProfileEvent[];
  pastEvents: ProfileEvent[];
  activity: ActivityItem[];
}

/** "marzo de 2026" */
function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-[var(--card-shadow)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-bold text-[var(--text)]">{title}</h2>
          {subtitle && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EventRow({ event }: { event: ProfileEvent }) {
  return (
    <Link
      href={`/events/${event.id}`}
      prefetch={false}
      className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)] transition-all duration-200"
    >
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt={event.name}
          width={56}
          height={56}
          unoptimized
          className="w-14 h-14 rounded-xl object-cover shrink-0"
        />
      ) : (
        <span className="w-14 h-14 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center text-2xl shrink-0">
          🎉
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-[var(--text)] text-sm truncate">
            {event.name}
          </span>
          {event.isOrganizer && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--primary)] font-medium">
              Organiza
            </span>
          )}
          {event.status === "maybe" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)] font-medium">
              Quizás
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
          {formatDateShort(event.date)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          {event.attendeeCount} asistente{event.attendeeCount === 1 ? "" : "s"}
          {event.gameCount > 0
            ? ` · ${event.gameCount} juego${event.gameCount === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>
    </Link>
  );
}

export default function PublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${slug}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se ha podido cargar el perfil");
        return data as PublicProfile;
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Si se ha entrado por el id teniendo usuario de BGG, dejamos la URL bonita
  // sin recargar ni ensuciar el historial.
  useEffect(() => {
    if (!profile) return;
    const canonical = `/users/${encodeURIComponent(profile.slug)}`;
    if (window.location.pathname !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
  }, [profile]);

  if (loading) {
    return (
      <>
        <Navbar />
        <PageLoader withNavbar />
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-6xl mb-4">🔍</p>
            <h1 className="text-xl font-bold text-[var(--text)] mb-2">
              {error || "Perfil no disponible"}
            </h1>
            <Link href="/groups" className="text-sm text-[var(--primary)] hover:underline">
              Volver a mis grupos
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const hasEvents =
    profile.upcomingEvents.length > 0 || profile.pastEvents.length > 0;
  // La vitrina vacía se oculta, salvo en tu propio perfil con BGG conectado:
  // ahí el hueco es la forma de enterarte de que existe.
  const showShowcase =
    profile.showcase.length > 0 || (profile.isSelf && !!profile.bggUsername);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-6 px-3 sm:px-4">
        <div className="max-w-2xl mx-auto">
          {/* ── Datos básicos ────────────────────────────────────────── */}
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 sm:p-5 shadow-[var(--card-shadow)]">
            <div className="flex items-center gap-4">
              <Avatar
                name={profile.displayName}
                avatarUrl={profile.avatarUrl}
                size="2xl"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] break-words leading-tight">
                    {profile.displayName}
                  </h1>
                  {profile.isSelf && (
                    <Link
                      href="/profile"
                      className="shrink-0 text-xs text-[var(--primary)] hover:underline"
                    >
                      Editar perfil
                    </Link>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {profile.location && <span>📍 {profile.location}</span>}
                  {profile.location && (
                    <span className="text-[var(--text-muted)]"> · </span>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">
                    desde {formatMonth(profile.memberSince)}
                  </span>
                </p>
                {profile.bggUsername && (
                  <a
                    href={`https://boardgamegeek.com/user/${profile.bggUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`@${profile.bggUsername} en BoardGameGeek`}
                    className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/15 transition-all duration-200"
                  >
                    <Image
                      src="/bgg-icon.svg"
                      alt="BGG"
                      width={14}
                      height={14}
                      className="w-[14px] h-auto"
                    />
                    <span className="text-[11px] font-medium leading-none">
                      @{profile.bggUsername}
                    </span>
                  </a>
                )}
              </div>
            </div>

            {/* Grupos en común */}
            {profile.sharedGroups.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  {profile.isSelf ? "Tus grupos" : "Grupos que tenéis en común"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.sharedGroups.map((group) => (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      prefetch={false}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)] transition-all duration-200"
                    >
                      <span>{getGroupType(group.type).emoji}</span>
                      {group.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Vitrina ──────────────────────────────────────────────── */}
          {showShowcase && (
            <Section
              title={profile.isSelf ? "Mi vitrina" : "Su vitrina"}
              subtitle="Los imprescindibles, los que enseñaría a cualquiera que entre en casa."
              action={
                profile.isSelf ? (
                  <Link
                    href="/collection"
                    className="shrink-0 text-xs text-[var(--primary)] hover:underline"
                  >
                    Editar
                  </Link>
                ) : undefined
              }
            >
              {profile.showcase.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  Todavía no has puesto nada.{" "}
                  <Link href="/collection" className="text-[var(--primary)] hover:underline">
                    Elige tus favoritos en Mi colección
                  </Link>{" "}
                  y aparecerán aquí.
                </p>
              ) : (
                <GameShelf games={profile.showcase} compact />
              )}
            </Section>
          )}

          {/* ── Eventos ──────────────────────────────────────────────── */}
          {hasEvents && (
            <Section title="Eventos" subtitle="A los que asiste.">
              <div className="space-y-4">
                {profile.upcomingEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                      Próximos
                    </p>
                    <div className="space-y-2">
                      {profile.upcomingEvents.map((event) => (
                        <EventRow key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                )}
                {profile.pastEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                      Ya pasados
                    </p>
                    <div className="space-y-2">
                      {profile.pastEvents.map((event) => (
                        <EventRow key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── Actividad reciente ───────────────────────────────────── */}
          {profile.activity.length > 0 && (
            <Section title="Actividad reciente">
              <ActivityFeed
                items={profile.activity}
                showContext
                minBlocks={0}
                linkUsers={false}
              />
            </Section>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
