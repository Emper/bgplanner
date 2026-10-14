"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  NOTIFICATIONS_EVENT,
  NotificationItem,
  NotificationsEmpty,
  markNotificationsRead,
  type NotificationItemData,
  type NotificationsPage,
} from "./NotificationList";
import { enablePush, getPushState, type PushState } from "@/lib/pushClient";

// Sin tiempo real: se mira al cargar la página, al volver a la pestaña y cada
// minuto mientras está a la vista. De sobra para una app de quedar a jugar.
const POLL_MS = 60_000;
const PANEL_LIMIT = 15;

// El contador sobrevive a los cambios de página (la navbar se monta de nuevo
// en cada una): así el globo sale ya puesto en vez de aparecer a destiempo.
let lastUnread: number | null = null;
const unreadListeners = new Set<() => void>();
const subscribeUnread = (cb: () => void) => {
  unreadListeners.add(cb);
  return () => {
    unreadListeners.delete(cb);
  };
};
const getUnread = () => lastUnread;
const getServerUnread = () => null;

type UnreadUpdate = number | null | ((prev: number | null) => number | null);
function setUnread(next: UnreadUpdate) {
  lastUnread = typeof next === "function" ? next(lastUnread) : next;
  unreadListeners.forEach((l) => l());
}

export default function NotificationBell() {
  const router = useRouter();
  // null hasta tener el primer recuento: se guarda el hueco para no mover nada
  const unread = useSyncExternalStore(subscribeUnread, getUnread, getServerUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(false);
  // Dónde va el panel. Se pinta en un portal porque el navbar lleva
  // backdrop-filter, y eso convierte su caja en la referencia de los
  // `position: fixed` de dentro (el fondo para cerrar no taparía la página).
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Para la fila de «Recibir avisos en este móvil» al pie del panel
  const [pushState, setPushState] = useState<PushState>("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushJustOn, setPushJustOn] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number };
      setUnread(data.unread);
    } catch {
      // sin red: ya lo intentará en la próxima vuelta
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const tick = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ unread: number }>).detail;
      if (typeof detail?.unread === "number") setUnread(detail.unread);
    };
    window.addEventListener(NOTIFICATIONS_EVENT, onChange);
    // Un push que llega con la app abierta (lo reenvía public/sw.js)
    const onPush = (e: MessageEvent) => {
      if (e.data?.type === "bgp:push" && typeof e.data.unread === "number") setUnread(e.data.unread);
    };
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener(NOTIFICATIONS_EVENT, onChange);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [refreshCount]);

  // Escape cierra el panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    const top = (rect?.bottom ?? 56) + 10;
    setPanelStyle(
      window.innerWidth < 640 || !rect
        ? { top, left: 12, right: 12 }
        : { top, right: Math.max(12, window.innerWidth - rect.right), width: 384 }
    );
    setOpen(true);
    setLoading(true);
    if (pushState === "loading" || pushState === "off") {
      getPushState()
        .then(setPushState)
        .catch(() => setPushState("unavailable"));
    }
    try {
      const res = await fetch(`/api/notifications?limit=${PANEL_LIMIT}`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as NotificationsPage;
        setItems(data.items);
        setUnread(data.unread);
      }
    } finally {
      setLoading(false);
    }
  };

  const openItem = (item: NotificationItemData) => {
    setOpen(false);
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      setUnread((u) => (u ? u - 1 : u));
      markNotificationsRead([item.id]);
    }
    router.push(item.href);
  };

  // Desde la campana se activa directamente: el clic ya es el gesto que pide
  // el navegador para enseñar su diálogo de permiso.
  const activatePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const next = await enablePush("bell");
      setPushState(next);
      setPushJustOn(next === "on");
    } catch {
      setPushState("off");
    } finally {
      setPushBusy(false);
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    await markNotificationsRead();
  };

  if (unread === null) return <span className="block w-9 h-9" aria-hidden />;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        aria-expanded={open}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
          open
            ? "text-[var(--primary)] bg-[var(--accent-soft)]"
            : "text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent-soft)]"
        }`}
      >
        <svg className={`w-5 h-5 ${unread > 0 ? "origin-top motion-safe:animate-[bell_1.2s_ease-in-out_1]" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-[var(--surface)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Notificaciones"
            style={panelStyle}
            className="fixed z-50 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-sm font-bold text-[var(--text)]">Notificaciones</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
            <div className="max-h-[min(70vh,32rem)] overflow-y-auto p-1.5">
              {loading && items.length === 0 ? (
                <div className="space-y-1 p-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-3 p-2 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-[var(--surface-hover)]" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 rounded bg-[var(--surface-hover)] w-4/5" />
                        <div className="h-2.5 rounded bg-[var(--surface-hover)] w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <NotificationsEmpty />
              ) : (
                items.map((item) => <NotificationItem key={item.id} item={item} onOpen={openItem} />)
              )}
            </div>
            {pushState === "off" && (
              <button
                type="button"
                onClick={activatePush}
                disabled={pushBusy}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium py-2.5 border-t border-[var(--border)] text-[var(--primary)] hover:bg-[var(--accent-soft)] disabled:opacity-60 transition-colors"
              >
                <span aria-hidden>📲</span>
                {pushBusy ? "Activando…" : `Recibir avisos en este ${isPhone() ? "móvil" : "dispositivo"}`}
              </button>
            )}
            {pushState === "on" && pushJustOn && (
              <p className="flex items-center justify-center gap-2 text-xs font-medium py-2.5 border-t border-[var(--border)] text-emerald-500">
                <span aria-hidden>✅</span>
                Listo: te avisaremos aquí aunque cierres la app
              </p>
            )}
            {pushState === "needs-install" && (
              <Link
                href="/notifications"
                prefetch={false}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 text-xs font-medium py-2.5 border-t border-[var(--border)] text-[var(--primary)] hover:bg-[var(--accent-soft)] transition-colors"
              >
                <span aria-hidden>📲</span>
                Recibir avisos en este móvil
              </Link>
            )}
            <Link
              href="/notifications"
              prefetch={false}
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium py-2.5 border-t border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Ver todas
            </Link>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function isPhone() {
  return window.matchMedia("(pointer: coarse)").matches;
}
