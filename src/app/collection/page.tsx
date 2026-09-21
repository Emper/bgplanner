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
  const [shareOpen, setShareOpen] = useState(false);

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
      <div className="min-h-screen bg-[var(--bg)] py-6 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">
                Mi colección
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                Puntúa cada juego según lo seguro que estés de que se queda
                contigo.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShareOpen(true)}
                title="Compartir mi colección"
                className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 transition-all duration-200"
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
          />
        </div>
      </div>

      {shareOpen && (
        <ShareModal onClose={() => setShareOpen(false)} onToast={showToast} />
      )}

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

// ── Compartir la colección ──────────────────────────────────────────────

function ShareModal({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    fetch("/api/collection/share", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setToken(data?.token ?? null))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const call = async (method: "POST" | "DELETE") => {
    setBusy(true);
    try {
      const res = await fetch("/api/collection/share", {
        method,
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token ?? null);
      setConfirmRevoke(false);
      onToast(
        method === "DELETE"
          ? "Enlace desactivado: ya no se puede abrir"
          : "Enlace listo para compartir"
      );
    } catch {
      onToast("No se ha podido cambiar el enlace");
    } finally {
      setBusy(false);
    }
  };

  const url = token ? `${window.location.origin}/c/${token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onToast("Enlace copiado");
    } catch {
      onToast("No se ha podido copiar; selecciónalo a mano");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-[var(--text)]">
              Compartir mi colección
            </h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="h-24 flex items-center justify-center">
              <span className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
            </div>
          ) : token ? (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                Cualquiera con este enlace y una cuenta de BG Planner puede ver tu
                colección y tus puntuaciones, <strong>incluido lo que quieres
                vender</strong>. No podrá cambiar nada.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text)] font-mono"
                />
                <button
                  onClick={copy}
                  className="shrink-0 px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200"
                >
                  Copiar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                <button
                  onClick={() => call("POST")}
                  disabled={busy}
                  className="px-3 py-1.5 bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-lg text-xs hover:text-[var(--text)] disabled:opacity-50 transition-colors"
                  title="Genera un enlace nuevo; el anterior deja de funcionar"
                >
                  Generar uno nuevo
                </button>
                {confirmRevoke ? (
                  <button
                    onClick={() => call("DELETE")}
                    disabled={busy}
                    className="px-3 py-1.5 bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    ¿Seguro? Dejar de compartir
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmRevoke(true)}
                    className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                  >
                    Dejar de compartir
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Genera un enlace para que alguien de confianza vea tu colección:
                tus juegos, tu wishlist y tus puntuaciones de permanencia. Solo
                puede mirar, no tocar nada, y hace falta tener cuenta en BG
                Planner para abrirlo. Puedes desactivarlo cuando quieras.
              </p>
              <button
                onClick={() => call("POST")}
                disabled={busy}
                className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-all duration-200"
              >
                {busy ? "Creando…" : "Crear enlace para compartir"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
