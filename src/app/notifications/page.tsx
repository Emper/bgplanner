"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageLoader from "@/components/PageLoader";
import {
  NotificationItem,
  NotificationsEmpty,
  announceUnread,
  markNotificationsRead,
  type NotificationItemData,
  type NotificationsPage,
} from "@/components/NotificationList";

const PAGE_SIZE = 30;

export default function NotificationsPageView() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (after: string | null) => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (after) qs.set("cursor", after);
    const res = await fetch(`/api/notifications?${qs}`, { credentials: "include" });
    if (!res.ok) throw new Error("No se han podido cargar las notificaciones");
    return (await res.json()) as NotificationsPage;
  }, []);

  useEffect(() => {
    load(null)
      .then((data) => {
        setItems(data.items);
        setUnread(data.unread);
        setCursor(data.nextCursor);
        announceUnread(data.unread);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error inesperado"))
      .finally(() => setLoading(false));
  }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await load(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(data.nextCursor);
    } catch {
      // se puede volver a pulsar
    } finally {
      setLoadingMore(false);
    }
  };

  const openItem = (item: NotificationItemData) => {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationsRead([item.id]);
    }
    router.push(item.href);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    await markNotificationsRead();
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[var(--text)]">Notificaciones</h1>
              {!loading && !error && (
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {unread > 0 ? `${unread} sin leer` : "Estás al día"}
                </p>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-all duration-200"
              >
                <span className="sm:hidden">Todas leídas</span>
                <span className="hidden sm:inline">Marcar todas como leídas</span>
              </button>
            )}
          </div>

          {loading && <PageLoader withNavbar />}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-1.5 shadow-[var(--card-shadow)]">
              {items.length === 0 ? (
                <NotificationsEmpty />
              ) : (
                <>
                  {items.map((item) => (
                    <NotificationItem key={item.id} item={item} onOpen={openItem} />
                  ))}
                  {cursor && (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full py-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                    >
                      {loadingMore ? "Cargando..." : "Ver más"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--text-muted)] text-center mt-4">
            Guardamos las notificaciones de los últimos 90 días.
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
