"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PushToggle from "@/components/PushToggle";
import {
  NotificationItem,
  NotificationsEmpty,
  announceUnread,
  markNotificationsRead,
  type NotificationItemData,
  type NotificationsPage,
} from "@/components/NotificationList";

// El mismo tamaño de página que NOTIFICATIONS_PAGE_SIZE (lib/notifications).
const PAGE_SIZE = 30;

/**
 * La lista de avisos. Llega con la primera página ya pedida en el servidor
 * (`initial`); sin ella, la pide al montar como antes.
 */
export default function NotificationsClient({ initial }: { initial?: NotificationsPage }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItemData[]>(initial?.items ?? []);
  const [unread, setUnread] = useState(initial?.unread ?? 0);
  const [cursor, setCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [loading, setLoading] = useState(!initial);
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
    // Con la primera página del servidor solo falta avisar a la campana.
    if (initial) {
      announceUnread(initial.unread);
      return;
    }
    load(null)
      .then((data) => {
        setItems(data.items);
        setUnread(data.unread);
        setCursor(data.nextCursor);
        announceUnread(data.unread);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error inesperado"))
      .finally(() => setLoading(false));
  }, [load, initial]);

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
    <PageShell nav={<Navbar />} width="text">
      <PageHeader
        title="Notificaciones"
        lead={!loading && !error ? (unread > 0 ? `${unread} sin leer` : "Estás al día") : undefined}
        action={
          unread > 0 && (
            <Button variant="secondary" onClick={markAll}>
              <span className="sm:hidden">Todas leídas</span>
              <span className="hidden sm:inline">Marcar todas como leídas</span>
            </Button>
          )
        }
      />

      <PushToggle />

      {loading && <PageLoader withNavbar />}
      {error && <Alert>{error}</Alert>}

      {!loading && !error && (
        <Card padding="none" className="p-1.5">
          {items.length === 0 ? (
            <NotificationsEmpty />
          ) : (
            <>
              {items.map((item) => (
                <NotificationItem key={item.id} item={item} onOpen={openItem} />
              ))}
              {cursor && (
                <Button variant="ghost" size="xs" block loading={loadingMore} onClick={loadMore} className="py-2.5 font-normal">
                  {loadingMore ? "Cargando…" : "Ver más"}
                </Button>
              )}
            </>
          )}
        </Card>
      )}

      <p className="text-xs text-[var(--text-muted)] text-center mt-4">
        Guardamos las notificaciones de los últimos 90 días.
      </p>
    </PageShell>
  );
}
