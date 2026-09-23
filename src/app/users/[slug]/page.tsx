import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import {
  getProfileHeader,
  getPublicProfile,
  profileTagline,
  type ProfileEvent,
} from "@/lib/publicProfile";
import SmartNav from "@/components/SmartNav";
import Footer from "@/components/Footer";
import Avatar from "@/components/Avatar";
import ActivityFeed from "@/components/ActivityFeed";
import GameShelf from "@/components/GameShelf";
import { formatDateShort } from "@/lib/format";
import { getGroupType } from "@/lib/groupTypes";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// Depende de quién mire (con cuenta se ven además los grupos en común) y de
// datos vivos: nada que prerrenderizar.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const header = await getProfileHeader(slug);

  // Next 16 manda los metadatos en streaming, así que desde aquí no se puede
  // devolver un 404 de verdad: lo que sí llega a los buscadores (que ejecutan
  // JS) es el noindex, para que una dirección inventada no acabe indexada.
  if (!header) {
    return {
      title: "Perfil no encontrado · BG Planner",
      robots: { index: false, follow: false },
    };
  }

  // Antes de renderizar nada: quien llegue por el id teniendo slug acaba en la
  // dirección buena, que es la que se indexa. Hacerlo aquí y no en la página
  // es lo que da una redirección de verdad en vez de un meta refresh.
  if (decodeURIComponent(slug) !== header.slug) {
    redirect(`/users/${encodeURIComponent(header.slug)}`);
  }

  const url = `${APP_URL}/users/${encodeURIComponent(header.slug)}`;
  const description = profileTagline(header);
  // La imagen de la tarjeta la pinta opengraph-image.tsx y Next la enlaza
  // sola, así que aquí no hay que decir nada de imágenes.
  return {
    title: `${header.displayName} · BG Planner`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${header.displayName} en BG Planner`,
      description,
      url,
      type: "profile",
      siteName: "BG Planner",
      locale: "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title: `${header.displayName} en BG Planner`,
      description,
    },
  };
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

function NotFound() {
  return (
    <>
      <SmartNav />
      <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-6xl mb-4">🔍</p>
          <h1 className="text-xl font-bold text-[var(--text)] mb-2">
            Aquí no hay ningún jugador
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Puede que haya cambiado su dirección o que el enlace esté mal copiado.
          </p>
          <Link href="/" className="text-sm text-[var(--primary)] hover:underline">
            Ir a BG Planner
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  const profile = await getPublicProfile(slug, session?.userId ?? null);

  if (!profile) return <NotFound />;

  const hasEvents =
    profile.upcomingEvents.length > 0 || profile.pastEvents.length > 0;
  // La vitrina vacía se oculta, salvo en tu propio perfil con BGG conectado:
  // ahí el hueco es la forma de enterarte de que existe.
  const showShowcase =
    profile.showcase.length > 0 || (profile.isSelf && !!profile.bggUsername);

  return (
    <>
      <SmartNav />
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

          {/* ── Invitación para quien llega de fuera ─────────────────── */}
          {!session && (
            <section className="mt-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-[var(--card-shadow)] text-center">
              <h2 className="text-base font-bold text-[var(--text)]">
                ¿Y tu mesa?
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
                En BG Planner tu grupo vota los juegos que tenéis, sale un ranking
                y de ahí salen las partidas. Monta tu perfil como este en un rato.
              </p>
              <Link
                href="/login"
                className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Entrar o crear cuenta
              </Link>
            </section>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
