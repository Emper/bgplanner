"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Avatar from "./Avatar";
import { getGroupedActivity, isGroupableActivity, type GroupedActivity } from "@/lib/activity";
import { profileHref } from "@/lib/users";

interface ActivityItem {
  id: string;
  type: string;
  scope: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null; slug?: string | null };
  group?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
  /** Carátula del juego del que habla el ítem, si la hay (la pone el servidor). */
  thumbnail?: string | null;
}

// ── In-memory feed cache (survives tab switches & navigations within SPA) ──
const feedCache = new Map<string, { items: ActivityItem[]; cursor: string | null; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function getCachedFeed(key: string) {
  const entry = feedCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    feedCache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedFeed(key: string, items: ActivityItem[], cursor: string | null) {
  feedCache.set(key, { items, cursor, ts: Date.now() });
}

// Invalida el feed cacheado tras una acción que cambia el historial en
// servidor (p. ej. reiniciar las votaciones del grupo).
export function clearCachedFeed(key: string) {
  feedCache.delete(key);
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Separadores del feed: hoy, ayer, esta semana y, más atrás, el mes. Dan
// ritmo a la lista y evitan leer "hace 3d" en cada línea para situarse.
function dayBucket(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return "Esta semana";
  const sameYear = d.getFullYear() === today.getFullYear();
  const label = d.toLocaleDateString("es-ES", sameYear ? { month: "long" } : { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Un emoji por tipo, en la esquina del avatar: se ve de un vistazo qué ha
// pasado sin leer la frase.
const TYPE_BADGES: Record<string, string> = {
  group_created: "✨",
  group_joined: "👋",
  group_pinged: "📯",
  votes_reset: "🧹",
  member_promoted: "🛡️",
  member_demoted: "🛡️",
  game_added: "🎲",
  game_removed: "📦",
  game_marked_played: "✅",
  game_returned_pending: "↩️",
  game_archived: "🙈",
  game_reviewed: "⭐",
  group_photo_added: "📷",
  vote_cast: "🗳️",
  vote_changed: "🗳️",
  vote_removed: "🗳️",
  vote_commented: "💬",
  session_created: "🗓️",
  session_updated: "🗓️",
  session_deleted: "🗓️",
  session_game_completed: "🏁",
  event_created: "🎉",
  event_updated: "🎉",
  event_joined: "🙋",
  event_left: "👋",
  event_game_added: "🎲",
  game_manual_added: "📖",
  event_geeklist_linked: "📋",
  event_geeklist_synced: "📋",
  event_interest_set: "💛",
  event_reviewed: "⭐",
  event_photo_added: "📷",
  friend_added: "🤝",
};

/** Carátulas de un run, sin repetir y en orden. */
function runCovers(items: ActivityItem[]): { name: string; src: string }[] {
  const seen = new Set<string>();
  const covers: { name: string; src: string }[] = [];
  for (const item of items) {
    if (!item.thumbnail || seen.has(item.thumbnail)) continue;
    seen.add(item.thumbnail);
    const name = (item.metadata as { gameName?: unknown }).gameName;
    covers.push({ name: typeof name === "string" ? name : "", src: item.thumbnail });
  }
  return covers;
}

const MAX_STRIP_COVERS = 5;

function CoverStrip({ covers }: { covers: { name: string; src: string }[] }) {
  if (covers.length === 0) return null;
  const shown = covers.slice(0, MAX_STRIP_COVERS);
  const rest = covers.length - shown.length;
  return (
    <div className="flex items-end gap-1.5 mt-2 mb-0.5">
      {shown.map((c, i) => (
        <Image
          key={c.src}
          src={c.src}
          alt={c.name}
          title={c.name}
          width={40}
          height={52}
          unoptimized
          className={`w-10 h-[52px] rounded-md object-cover shadow-sm ring-1 ring-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:rotate-0 ${
            i % 2 === 0 ? "-rotate-[1.5deg]" : "rotate-[1.5deg]"
          }`}
        />
      ))}
      {rest > 0 && (
        <span className="w-10 h-[52px] rounded-md bg-[var(--surface-hover)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
          +{rest}
        </span>
      )}
    </div>
  );
}

function SkeletonRow({ showAvatar = true }: { showAvatar?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2 px-1 animate-pulse">
      {showAvatar ? (
        <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] shrink-0" />
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-[var(--surface-hover)] rounded-md w-3/4" />
        <div className="h-2.5 bg-[var(--surface-hover)] rounded-md w-1/4" />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ animationDelay: `${i * 80}ms` }}>
          <SkeletonRow showAvatar={i === 0 || i === 3} />
        </div>
      ))}
    </div>
  );
}

// Cada "run" agrupa ítems consecutivos del mismo tipo dentro de un mismo
// bloque de usuario, para poder colapsarlos en una sola línea.
interface ItemRun {
  type: string;
  items: ActivityItem[];
}

interface UserGroup {
  userId: string;
  userName: string;
  /** Enlace a su perfil público, ya resuelto (usuario de BGG o id). */
  userHref: string;
  avatarUrl: string | null;
  runs: ItemRun[];
}

function groupItems(items: ActivityItem[]): UserGroup[] {
  const groups: UserGroup[] = [];
  for (const item of items) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.userId === item.userId) {
      const lastRun = lastGroup.runs[lastGroup.runs.length - 1];
      // Solo agrupamos en un mismo run los tipos para los que tiene sentido
      // resumir en una lista (añadir, votar…). El resto va en runs separados.
      if (lastRun.type === item.type && isGroupableActivity(item.type)) {
        lastRun.items.push(item);
      } else {
        lastGroup.runs.push({ type: item.type, items: [item] });
      }
    } else {
      groups.push({
        userId: item.userId,
        userName: item.user.displayName || item.user.name || "Alguien",
        userHref: profileHref({ id: item.userId, slug: item.user.slug }),
        avatarUrl: item.user.avatarUrl,
        runs: [{ type: item.type, items: [item] }],
      });
    }
  }
  return groups;
}

// Para "creó el grupo" / "se unió al grupo" el nombre va pegado al verbo
// (sin "en"), porque "se unió al grupo en C&N" no suena bien.
const APPEND_CONTEXT_TYPES = new Set(["group_created", "group_joined"]);

function PartSpan({ name, affix }: { name: string; affix?: string }) {
  return (
    <span>
      <span className="text-[var(--text)]">&quot;{name}&quot;</span>
      {affix && <span> {affix}</span>}
    </span>
  );
}

function GroupedLine({ data }: { data: GroupedActivity }) {
  const { prefix, visible, hidden } = data;
  if (visible.length === 0) return <>{prefix}</>;
  return (
    <>
      {prefix}{" "}
      {visible.map((p, i) => {
        const isLast = i === visible.length - 1;
        const sep = i === 0
          ? null
          : isLast && hidden.length === 0
            ? <> y </>
            : <>, </>;
        return (
          <span key={i}>
            {sep}
            <PartSpan name={p.name} affix={p.affix} />
          </span>
        );
      })}
      {hidden.length > 0 && (
        <>
          {" "}y{" "}
          <span className="relative group/more inline-block">
            <span className="cursor-help underline decoration-dotted decoration-[var(--text-muted)] underline-offset-2">
              {hidden.length} más
            </span>
            <span className="invisible group-hover/more:visible absolute left-0 bottom-full mb-1.5 z-50 w-max max-w-[260px] bg-[var(--bg)] border border-[var(--border-strong)] rounded-lg shadow-xl p-2.5 text-xs text-[var(--text-secondary)] text-left flex flex-col gap-1">
              {hidden.map((h, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="truncate text-[var(--text)]">&quot;{h.name}&quot;</span>
                  {h.affix && <span className="shrink-0">{h.affix}</span>}
                </span>
              ))}
            </span>
          </span>
        </>
      )}
    </>
  );
}

const MIN_VISIBLE_BLOCKS = 5;
const MAX_AUTOLOAD_ATTEMPTS = 3;

export default function ActivityFeed({
  items,
  showContext = false,
  onLoadMore,
  hasMore = false,
  loading = false,
  minBlocks = MIN_VISIBLE_BLOCKS,
  linkUsers = true,
}: {
  items: ActivityItem[];
  showContext?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  minBlocks?: number;
  /** Enlaza autor y avatar a su perfil público. Se apaga en el propio perfil. */
  linkUsers?: boolean;
}) {
  // Deduplicamos por id como red de seguridad: si por una carrera entre
  // cargas consecutivas o por el mismo render bajo Strict Mode llega un
  // item dos veces, evitamos que React tire warnings de keys duplicadas.
  const dedupedItems = items.length
    ? Array.from(new Map(items.map((i) => [i.id, i])).values())
    : items;
  const groups = dedupedItems.length ? groupItems(dedupedItems) : [];

  // Auto-cargar páginas adicionales si tras agrupar quedan menos bloques
  // de los esperados. Limitado para evitar bucles si el feed real es corto.
  const autoloadAttemptsRef = useRef(0);
  useEffect(() => {
    if (!hasMore || loading || !onLoadMore) return;
    if (groups.length >= minBlocks) return;
    if (autoloadAttemptsRef.current >= MAX_AUTOLOAD_ATTEMPTS) return;
    autoloadAttemptsRef.current++;
    onLoadMore();
  }, [groups.length, hasMore, loading, onLoadMore, minBlocks]);

  if (items.length === 0 && loading) {
    return <LoadingSkeleton />;
  }

  if (items.length === 0 && !loading) {
    return (
      <p className="text-sm text-[var(--text-muted)] text-center py-4">
        No hay actividad reciente
      </p>
    );
  }

  const buckets = groups.map((g) => dayBucket(g.runs[0].items[0].createdAt));

  return (
    <div>
      {groups.map((group, groupIndex) => {
        const latestTime = group.runs[0].items[0].createdAt;
        const hasMultipleRuns = group.runs.length > 1;
        const bucket = buckets[groupIndex];
        const showBucket = groupIndex === 0 || bucket !== buckets[groupIndex - 1];
        const badge = TYPE_BADGES[group.runs[0].type];
        const coversByRun = group.runs.map((run) => runCovers(run.items));
        // Una sola carátula en todo el bloque va a la derecha, grande; si hay
        // varias, en tira bajo cada línea.
        const soloCover =
          !hasMultipleRuns && coversByRun[0].length === 1 ? coversByRun[0][0] : null;
        const avatar = (
          <span className="relative block">
            <Avatar name={group.userName} avatarUrl={group.avatarUrl} size="sm" />
            {badge && (
              <span
                className="absolute -bottom-1 -right-1.5 w-[18px] h-[18px] rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)] flex items-center justify-center text-[10px] leading-none"
                aria-hidden
              >
                {badge}
              </span>
            )}
          </span>
        );
        return (
          <div key={`${group.userId}-${group.runs[0].items[0].id}`}>
            {showBucket && (
              <div className={`flex items-center gap-2 px-1 pb-1 ${groupIndex === 0 ? "" : "pt-3"}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {bucket}
                </span>
                <span className="flex-1 h-px bg-[var(--border)]" />
              </div>
            )}
          <div className="flex gap-3 py-2.5 px-1">
            <div className="flex flex-col items-center shrink-0 w-8">
              {linkUsers ? (
                <Link href={group.userHref} prefetch={false} aria-label={group.userName}>
                  {avatar}
                </Link>
              ) : (
                avatar
              )}
              {hasMultipleRuns && (
                <div className="flex-1 w-0.5 bg-[var(--border)] mt-2 mb-0.5 rounded-full" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-[var(--text-secondary)] leading-snug">
                {linkUsers ? (
                  <Link
                    href={group.userHref}
                    prefetch={false}
                    className="font-semibold text-[var(--text)] hover:text-[var(--primary)] transition-colors"
                  >
                    {group.userName}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--text)]">{group.userName}</span>
                )}
              </p>
              <div className="space-y-1 mt-0.5">
                {group.runs.map((run, runIndex) => {
                  const data = getGroupedActivity(
                    run.type,
                    run.items.map((i) => i.metadata as Record<string, unknown>)
                  );
                  const ctx = showContext
                    ? run.items[0].group
                      ? { name: run.items[0].group.name, href: `/groups/${run.items[0].group.id}` }
                      : run.items[0].event
                        ? { name: run.items[0].event.name, href: `/events/${run.items[0].event.id}` }
                        : null
                    : null;
                  const appendContext = APPEND_CONTEXT_TYPES.has(run.type);
                  return (
                    <div key={run.items[0].id}>
                    <p className="text-sm text-[var(--text-secondary)] leading-snug">
                      <GroupedLine data={data} />
                      {ctx && appendContext && (
                        <>
                          {" "}
                          <Link
                            href={ctx.href}
                            prefetch={false}
                            className="text-[var(--text)] hover:text-[var(--primary)] transition-colors"
                          >
                            {ctx.name}
                          </Link>
                        </>
                      )}
                      {ctx && !appendContext && (
                        <>
                          <span className="text-[var(--text-muted)]"> en </span>
                          <Link
                            href={ctx.href}
                            prefetch={false}
                            className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                          >
                            {ctx.name}
                          </Link>
                        </>
                      )}
                    </p>
                    {!soloCover && <CoverStrip covers={coversByRun[runIndex]} />}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                {timeAgo(latestTime)}
              </p>
            </div>
            {soloCover && (
              <Image
                src={soloCover.src}
                alt={soloCover.name}
                title={soloCover.name}
                width={48}
                height={64}
                unoptimized
                className="shrink-0 w-12 h-16 rounded-lg object-cover shadow-md ring-1 ring-black/10 rotate-[2deg] transition-transform duration-200 hover:rotate-0 hover:scale-105"
              />
            )}
          </div>
          </div>
        );
      })}
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
        >
          {loading ? "Cargando..." : "Ver más"}
        </button>
      )}
    </div>
  );
}
