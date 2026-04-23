"use client";

import { useEffect, useRef } from "react";
import Avatar from "./Avatar";
import { getGroupedActivity, isGroupableActivity, type GroupedActivity } from "@/lib/activity";

interface ActivityItem {
  id: string;
  type: string;
  scope: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null };
  group?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
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
}: {
  items: ActivityItem[];
  showContext?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  minBlocks?: number;
}) {
  const groups = items.length ? groupItems(items) : [];

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

  return (
    <div>
      {groups.map((group) => {
        const latestTime = group.runs[0].items[0].createdAt;
        const hasMultipleRuns = group.runs.length > 1;
        return (
          <div key={`${group.userId}-${group.runs[0].items[0].id}`} className="flex gap-3 py-2.5 px-1">
            <div className="flex flex-col items-center shrink-0 w-8">
              <Avatar
                name={group.userName}
                avatarUrl={group.avatarUrl}
                size="sm"
              />
              {hasMultipleRuns && (
                <div className="flex-1 w-0.5 bg-[var(--border)] mt-2 mb-0.5 rounded-full" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-[var(--text-secondary)] leading-snug">
                <span className="font-semibold text-[var(--text)]">{group.userName}</span>
              </p>
              <div className="space-y-1 mt-0.5">
                {group.runs.map((run) => {
                  const data = getGroupedActivity(
                    run.type,
                    run.items.map((i) => i.metadata as Record<string, unknown>)
                  );
                  const contextName = showContext
                    ? run.items[0].group?.name || run.items[0].event?.name
                    : null;
                  const appendContext = APPEND_CONTEXT_TYPES.has(run.type);
                  return (
                    <p
                      key={run.items[0].id}
                      className="text-sm text-[var(--text-secondary)] leading-snug"
                    >
                      <GroupedLine data={data} />
                      {contextName && appendContext && (
                        <span className="text-[var(--text)]"> {contextName}</span>
                      )}
                      {contextName && !appendContext && (
                        <span className="text-[var(--text-muted)]"> en {contextName}</span>
                      )}
                    </p>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                {timeAgo(latestTime)}
              </p>
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
