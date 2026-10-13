"use client";

import Image from "next/image";
import Avatar from "./Avatar";

// Piezas compartidas por la campana del navbar y la página /notifications.

export interface NotificationItemData {
  id: string;
  type: string;
  emoji: string;
  parts: { text: string; strong?: boolean }[];
  href: string;
  thumbnail: string | null;
  actor: { name: string; avatarUrl: string | null } | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  items: NotificationItemData[];
  unread: number;
  nextCursor: string | null;
}

// La campana y la página se enteran la una de la otra con este evento: si
// marcas como leídas en un sitio, el globo del otro baja a la vez.
export const NOTIFICATIONS_EVENT = "bgp:notifications";

export function announceUnread(unread: number) {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT, { detail: { unread } }));
}

export async function markNotificationsRead(ids?: string[]): Promise<number | null> {
  try {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(ids ? { ids } : {}),
    });
    if (!res.ok) return null;
    const { unread } = (await res.json()) as { unread: number };
    announceUnread(unread);
    return unread;
  } catch {
    return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function NotificationItem({
  item,
  onOpen,
}: {
  item: NotificationItemData;
  /** Al pulsar: marcar como leída y navegar. */
  onOpen: (item: NotificationItemData) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors duration-150 hover:bg-[var(--surface-hover)] ${
        item.read ? "" : "bg-[var(--accent-soft)]"
      }`}
    >
      <span className="relative shrink-0 mt-0.5">
        {item.actor ? (
          <Avatar name={item.actor.name} avatarUrl={item.actor.avatarUrl} size="md" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-center text-lg">
            {item.emoji}
          </span>
        )}
        {item.actor && (
          <span
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--surface)] ring-1 ring-[var(--border)] flex items-center justify-center text-[11px] leading-none"
            aria-hidden
          >
            {item.emoji}
          </span>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm leading-snug text-[var(--text-secondary)]">
          {item.parts.map((p, i) =>
            p.strong ? (
              <span key={i} className="font-semibold text-[var(--text)]">
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </span>
        <span className={`block mt-1 text-[11px] ${item.read ? "text-[var(--text-muted)]" : "text-[var(--primary)] font-medium"}`}>
          {timeAgo(item.createdAt)}
        </span>
      </span>
      {item.thumbnail && (
        <Image
          src={item.thumbnail}
          alt=""
          width={40}
          height={52}
          unoptimized
          className="shrink-0 w-10 h-[52px] rounded-md object-cover shadow-sm ring-1 ring-black/10"
        />
      )}
      {!item.read && (
        <span className="shrink-0 self-center w-2 h-2 rounded-full bg-[var(--primary)]" aria-label="Sin leer" />
      )}
    </button>
  );
}

export function NotificationsEmpty() {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-3xl mb-2">✨</p>
      <p className="text-sm font-semibold text-[var(--text)]">Todo al día</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">
        Aquí te avisaremos cuando alguien te añada a sus amigos, se apunte a tus eventos o toque valorar una partida.
      </p>
    </div>
  );
}
