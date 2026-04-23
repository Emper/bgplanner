"use client";

import Avatar from "./Avatar";
import { formatGroupedActivity, isGroupableActivity } from "@/lib/activity";

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

export default function ActivityFeed({
  items,
  showContext = false,
  onLoadMore,
  hasMore = false,
  loading = false,
}: {
  items: ActivityItem[];
  showContext?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}) {
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

  const groups = groupItems(items);

  return (
    <div>
      {groups.map((group) => {
        // El timestamp del bloque entero es el del item más reciente.
        const latestTime = group.runs[0].items[0].createdAt;
        const hasMultipleRuns = group.runs.length > 1;
        return (
          <div key={`${group.userId}-${group.runs[0].items[0].id}`} className="flex gap-3 py-2.5 px-1">
            {/* Avatar + línea vertical conectora */}
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
            {/* Acciones del usuario */}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-[var(--text-secondary)] leading-snug">
                <span className="font-semibold text-[var(--text)]">{group.userName}</span>
              </p>
              <div className="space-y-1 mt-0.5">
                {group.runs.map((run) => {
                  const text = formatGroupedActivity(
                    run.type,
                    run.items.map((i) => i.metadata as Record<string, unknown>)
                  );
                  const context = showContext
                    ? run.items[0].group?.name || run.items[0].event?.name
                    : null;
                  return (
                    <p
                      key={run.items[0].id}
                      className="text-sm text-[var(--text-secondary)] leading-snug"
                    >
                      {text}
                      {context && (
                        <span className="text-[var(--text-muted)]"> en {context}</span>
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
