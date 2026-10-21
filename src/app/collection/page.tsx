"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageLoader from "@/components/PageLoader";
import CollectionBrowser from "@/components/CollectionBrowser";
import type { CollectionItemView } from "@/lib/collection";

interface ApiResponse {
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

function CollectionPageInner() {
  // La colección entera vive aquí; filtrar y ordenar no vuelve al servidor.
  const [all, setAll] = useState<CollectionItemView[] | null>(null);
  const [meta, setMeta] = useState<ApiResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [linkProgress, setLinkProgress] = useState<{ done: number; total: number } | null>(null);
  const enrichedRef = useRef(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

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
          showToast(
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
    []
  );

  // Primero lo que hay en caché (rápido) y, si hace falta, la sincronización
  // con BGG después, sin bloquear la pintada inicial.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = await fetchCollection(false);
      if (cancelled || !first?.connected) return;
      if (first.empty || first.stale) await fetchCollection(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCollection]);

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
      showToast(err instanceof Error ? err.message : "No se ha podido guardar");
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
      showToast("Quitado de tu wishlist");
    } catch {
      setAll(previous);
      showToast("No se ha podido quitar");
    }
  };

  // Se comparte la colección de tu perfil. Lo que puntúas aquí solo lo ven
  // tus amigos, así que el enlace se puede soltar donde sea.
  const share = async () => {
    if (!meta?.profileSlug) return;
    const url = `${window.location.origin}/users/${encodeURIComponent(meta.profileSlug)}/collection`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mi colección en BG Planner", url });
        return;
      } catch (err) {
        // Cerrar el menú de compartir no es un error; lo demás, al portapapeles.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Enlace copiado. La permanencia solo la ven tus amigos");
    } catch {
      showToast("No se ha podido copiar el enlace");
    }
  };

  const toggleShowcase = (bggId: number) => {
    const current = all?.find((i) => i.bggId === bggId);
    if (!current) return;
    saveEntry(bggId, { showcased: !current.showcased });
  };

  // Sin usuario de BGG no hay colección que enseñar.
  if (meta && !meta.connected) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
          <div className="max-w-xl mx-auto bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-8 text-center">
            <div className="text-4xl mb-3">🗄️</div>
            <h1 className="text-xl font-bold text-[var(--text)] mb-2">Mi colección</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Conecta tu usuario de BoardGameGeek y traemos tu colección aquí para
              que puedas puntuar qué juegos se quedan y cuáles se van.
            </p>
            <Link
              href="/profile"
              className="inline-flex px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200"
            >
              Conectar mi cuenta de BGG
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const firstSync = syncing && (!all || all.length === 0);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] page-pad">
        <div className="page-wide">
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="page-title">
                Mi colección
              </h1>
              <p className="page-lead mt-1">
                Puntúa cada juego según lo seguro que estés de que se queda
                contigo. Tus puntuaciones solo las ven tus amigos.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/collection/recommendations"
                title="Juegos que te pueden gustar"
                className="px-3 py-2 bg-[var(--accent-soft)] border border-[var(--primary)]/30 rounded-xl text-sm font-semibold text-[var(--primary)] hover:border-[var(--primary)]/60 transition-all duration-200"
              >
                <span className="sm:hidden">✨</span>
                <span className="hidden sm:inline">✨ Recomendaciones</span>
              </Link>
              <button
                onClick={share}
                disabled={!meta?.profileSlug}
                title="Compartir mi colección"
                className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 disabled:opacity-50 transition-all duration-200"
              >
                <span className="sm:hidden">↗</span>
                <span className="hidden sm:inline">↗ Compartir</span>
              </button>
              <button
                onClick={refreshFromBgg}
                disabled={syncing}
                title="Volver a traer la colección desde BGG"
                className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 disabled:opacity-50 transition-all duration-200"
              >
                <span className={syncing ? "animate-spin inline-block" : ""}>↻</span>
              </button>
            </div>
          </div>

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

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            </div>
          )}

          <CollectionBrowser
            items={all}
            loading={firstSync}
            fetchedAt={meta?.fetchedAt}
            onScore={(bggId, value) => saveEntry(bggId, { keepScore: value })}
            onToggleShowcase={toggleShowcase}
            onRemoveSaved={removeSaved}
          />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-lg text-sm text-[var(--text)] max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      <Footer />
    </>
  );
}

export default function CollectionPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <PageLoader withNavbar />
        </>
      }
    >
      <CollectionPageInner />
    </Suspense>
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
    <div className="mb-4 rounded-2xl border border-[var(--primary)]/30 bg-[var(--accent-soft)] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
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
