"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import CollectionBrowser from "@/components/CollectionBrowser";
import Alert from "@/components/ui/Alert";
import Button, { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { shareOrCopy } from "@/lib/clipboard";
import { shareUrl } from "@/lib/site";
import type { CollectionItemView } from "@/lib/collection";

export interface ApiResponse {
  connected: boolean;
  bggUsername?: string;
  profileSlug?: string;
  items: CollectionItemView[];
  pendingLinks: number;
  fetchedAt: string | null;
  empty: boolean;
  stale: boolean;
  syncError: string | null;
}

/**
 * Mi colección. Llega con lo que hay en caché ya pedido en el servidor
 * (`initial`); sin ello, lo pide al montar como antes.
 */
export default function CollectionClient({ initial }: { initial?: ApiResponse }) {
  // La colección entera vive aquí; filtrar y ordenar no vuelve al servidor.
  const [all, setAll] = useState<CollectionItemView[] | null>(
    initial ? (initial.connected ? initial.items : []) : null
  );
  const [meta, setMeta] = useState<ApiResponse | null>(initial ?? null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  const [linkProgress, setLinkProgress] = useState<{ done: number; total: number } | null>(null);
  const enrichedRef = useRef(false);

  // ── Carga ─────────────────────────────────────────────────────────────

  const fetchCollection = useCallback(
    async (refresh: boolean): Promise<ApiResponse | null> => {
      if (refresh) setSyncing(true);
      setError("");
      try {
        const res = await fetch(
          `/api/collection${refresh ? "?refresh=true" : ""}`,
          { credentials: "include" }
        );
        const json: ApiResponse & { error?: string } = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al cargar la colección");

        setMeta(json);
        setAll(json.connected ? json.items : []);
        if (json.syncError) {
          toast(
            `BGG no ha respondido (${json.syncError}). Te enseñamos lo último que teníamos.`
          );
        }
        return json;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado");
        return null;
      } finally {
        if (refresh) setSyncing(false);
      }
    },
    [toast]
  );

  // Primero lo que hay en caché (rápido) y, si hace falta, la sincronización
  // con BGG después, sin bloquear la pintada inicial.
  // Si lo cacheado vino del servidor, aquí solo queda sincronizar si toca.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = initial ?? (await fetchCollection(false));
      if (cancelled || !first?.connected) return;
      if (first.empty || first.stale) await fetchCollection(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCollection, initial]);

  const refreshFromBgg = async () => {
    enrichedRef.current = false;
    await fetchCollection(true);
  };

  // Las expansiones no dicen de qué juego son hasta que se lo preguntamos a
  // BGG juego a juego. Se hace en segundo plano y por lotes mientras el
  // usuario ya está viendo su colección.
  useEffect(() => {
    // Mientras la colección esté por sincronizar no tiene sentido emparejar
    // nada: la sincronización puede traer expansiones nuevas, y además así
    // no competimos con ella por el turno de habla con BGG.
    if (
      !meta?.connected ||
      !meta.pendingLinks ||
      meta.stale ||
      meta.empty ||
      syncing ||
      enrichedRef.current
    )
      return;
    enrichedRef.current = true;
    let cancelled = false;
    const total = meta.pendingLinks;
    setLinkProgress({ done: 0, total });

    (async () => {
      // Tope de seguridad: 25 lotes de 20 juegos es más que cualquier
      // colección razonable y evita quedarse dando vueltas si algo falla.
      for (let i = 0; i < 25 && !cancelled; i++) {
        try {
          const res = await fetch("/api/collection/enrich", {
            method: "POST",
            credentials: "include",
          });
          if (!res.ok) break;
          const json = await res.json();
          setLinkProgress({ done: Math.max(0, total - json.remaining), total });
          // Si BGG no ha contestado nada, no tiene sentido insistir.
          if (!json.answered || !json.remaining) break;
        } catch {
          break;
        }
      }
      if (!cancelled) {
        setLinkProgress(null);
        fetchCollection(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [meta?.connected, meta?.pendingLinks, meta?.stale, meta?.empty, syncing, fetchCollection]);

  // ── Guardado ──────────────────────────────────────────────────────────

  const saveEntry = async (
    bggId: number,
    patch: { keepScore?: number | null; showcased?: boolean; note?: string | null }
  ) => {
    // El juego puede estar en la lista por sí mismo o colgando de su base
    // como expansión; hay que tocar los dos sitios para que la vista cuadre.
    const apply = (item: CollectionItemView): CollectionItemView => {
      if (item.bggId === bggId) return { ...item, ...patch };
      if (
        patch.keepScore !== undefined &&
        item.expansions.some((e) => e.bggId === bggId)
      ) {
        return {
          ...item,
          expansions: item.expansions.map((e) =>
            e.bggId === bggId ? { ...e, ownKeepScore: patch.keepScore ?? null } : e
          ),
        };
      }
      return item;
    };

    const previous = all;
    setAll((prev) => (prev ? prev.map(apply) : prev));

    try {
      const res = await fetch(`/api/collection/${bggId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "No se ha podido guardar");
      }
    } catch (err) {
      setAll(previous);
      toast.error(err instanceof Error ? err.message : "No se ha podido guardar");
    }
  };

  const removeSaved = async (bggId: number) => {
    const previous = all;
    setAll((prev) => (prev ? prev.filter((i) => i.bggId !== bggId) : prev));
    try {
      const res = await fetch(`/api/recommendations/${bggId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flag: null }),
      });
      if (!res.ok) throw new Error();
      toast("Quitado de tu wishlist");
    } catch {
      setAll(previous);
      toast.error("No se ha podido quitar");
    }
  };

  // Se comparte la colección de tu perfil. Lo que puntúas aquí solo lo ven
  // tus amigos, así que el enlace se puede soltar donde sea.
  const share = async () => {
    if (!meta?.profileSlug) return;
    const result = await shareOrCopy({
      title: "Mi colección en BG Planner",
      url: shareUrl(`/users/${encodeURIComponent(meta.profileSlug)}/collection`),
    });
    if (result === "copied") toast("Enlace copiado. La permanencia solo la ven tus amigos");
    else if (result === "failed") toast.error("No se ha podido copiar el enlace");
  };

  const toggleShowcase = (bggId: number) => {
    const current = all?.find((i) => i.bggId === bggId);
    if (!current) return;
    saveEntry(bggId, { showcased: !current.showcased });
  };

  // Sin usuario de BGG no hay colección que enseñar.
  if (meta && !meta.connected) {
    return (
      <PageShell nav={<Navbar />} width="form">
        <Notice
          icon="🗄️"
          title="Mi colección"
          actions={<ButtonLink href="/profile">Conectar mi cuenta de BGG</ButtonLink>}
        >
          <p>
            Conecta tu usuario de BoardGameGeek y traemos tu colección aquí para
            que puedas puntuar qué juegos se quedan y cuáles se van.
          </p>
        </Notice>
      </PageShell>
    );
  }

  const firstSync = syncing && (!all || all.length === 0);

  return (
    <PageShell nav={<Navbar />} width="wide">
      <PageHeader
        title="Mi colección"
        lead="Puntúa cada juego según lo seguro que estés de que se queda contigo. Tus puntuaciones solo las ven tus amigos."
        action={
          <>
            <ButtonLink
              href="/collection/recommendations"
              variant="soft"
              title="Juegos que te pueden gustar"
              aria-label="Recomendaciones"
            >
              <span className="sm:hidden" aria-hidden>✨</span>
              <span className="hidden sm:inline">✨ Recomendaciones</span>
            </ButtonLink>
            <Button
              variant="secondary"
              onClick={share}
              disabled={!meta?.profileSlug}
              title="Compartir mi colección"
              aria-label="Compartir mi colección"
            >
              <span className="sm:hidden" aria-hidden>↗</span>
              <span className="hidden sm:inline">↗ Compartir</span>
            </Button>
            <Button
              variant="secondary"
              onClick={refreshFromBgg}
              disabled={syncing}
              title="Volver a traer la colección desde BGG"
              aria-label="Volver a traer la colección desde BGG"
            >
              {syncing ? <Spinner size="xs" tone="current" /> : <span aria-hidden>↻</span>}
            </Button>
          </>
        }
      />

      {/* Qué está pasando ahora mismo */}
      {syncing && (
        <Banner
          title={
            firstSync
              ? "Trayendo tu colección de BoardGameGeek…"
              : "Actualizando desde BoardGameGeek…"
          }
          text="BGG tarda unos segundos en preparar los datos de una colección. Puedes quedarte mirando o volver luego."
        />
      )}

      {linkProgress && (
        <Banner
          title={`Colocando las expansiones… ${linkProgress.done} de ${linkProgress.total}`}
          text="Le estamos preguntando a BGG de qué juego es cada expansión para agruparlas con él. Mientras tanto puedes puntuar con normalidad."
          progress={linkProgress.total > 0 ? linkProgress.done / linkProgress.total : 0}
        />
      )}

      {error && <Alert className="mb-4">{error}</Alert>}

      <CollectionBrowser
        items={all}
        loading={firstSync}
        fetchedAt={meta?.fetchedAt}
        onScore={(bggId, value) => saveEntry(bggId, { keepScore: value })}
        onToggleShowcase={toggleShowcase}
        onRemoveSaved={removeSaved}
      />
    </PageShell>
  );
}

// ── Aviso de "esto está pasando ahora", con barra de avance opcional ────

function Banner({
  title,
  text,
  progress,
}: {
  title: string;
  text: string;
  progress?: number;
}) {
  return (
    <div role="status" className="mb-4 rounded-2xl border border-[var(--primary)]/30 bg-[var(--accent-soft)] p-4">
      <div className="flex items-start gap-3">
        <Spinner size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--primary)]">{title}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{text}</p>
          {progress !== undefined && (
            <div className="mt-2 h-1 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
