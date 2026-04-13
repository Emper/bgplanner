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
  user: { id: string; name: string | null; avatarUrl: string | null };
  group?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
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
  if (items.length === 0 && !loading) {
    return (
      <p className="text-sm text-[var(--text-muted)] text-center py-4">
        No hay actividad reciente
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const text = formatActivity(item.type, item.metadata as Record<string, unknown>);
        const userName = item.user.name || "Alguien";
        const context = showContext
          ? item.group?.name || item.event?.name
          : null;

        return (
          <div
            key={item.id}
            className="flex items-start gap-2.5 py-2 px-1"
          >
            <Avatar
              name={userName}
              avatarUrl={item.user.avatarUrl}
              size="xs"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-secondary)] leading-snug">
                <span className="font-medium text-[var(--text)]">{userName}</span>{" "}
                {text}
                {context && (
                  <span className="text-[var(--text-muted)]"> en {context}</span>
                )}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {timeAgo(item.createdAt)}
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
