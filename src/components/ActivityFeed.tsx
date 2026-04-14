"use client";

import Avatar from "./Avatar";
import { formatActivity } from "@/lib/activity";

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

// Group consecutive items by the same user
interface ItemGroup {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  items: ActivityItem[];
}

function groupByUser(items: ActivityItem[]): ItemGroup[] {
  const groups: ItemGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.userId === item.userId) {
      last.items.push(item);
    } else {
      groups.push({
        userId: item.userId,
        userName: item.user.displayName || item.user.name || "Alguien",
        avatarUrl: item.user.avatarUrl,
        items: [item],
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

  const groups = groupByUser(items);

  return (
    <div>
      {groups.map((group) => (
        <div key={`${group.userId}-${group.items[0].id}`} className="flex gap-3 py-2 px-1">
          {/* Avatar + vertical line column */}
          <div className="flex flex-col items-center shrink-0 w-8">
            <Avatar
              name={group.userName}
              avatarUrl={group.avatarUrl}
              size="sm"
            />
            {group.items.length > 1 && (
              <div className="flex-1 w-px bg-[var(--border)] mt-1.5 mb-0.5 rounded-full" />
            )}
          </div>
          {/* Actions */}
          <div className="flex-1 min-w-0 pt-1">
            {group.items.map((item, idx) => {
              const text = formatActivity(item.type, item.metadata as Record<string, unknown>);
              const context = showContext
                ? item.group?.name || item.event?.name
                : null;

              return (
                <div key={item.id} className={idx > 0 ? "mt-2.5" : ""}>
                  <p className="text-sm text-[var(--text-secondary)] leading-snug">
                    {idx === 0 && (
                      <span className="font-medium text-[var(--text)]">{group.userName} </span>
                    )}
                    {text}
                    {context && (
                      <span className="text-[var(--text-muted)]"> en {context}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
