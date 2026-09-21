"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BggRating from "@/components/BggRating";
import KeepScoreSlider from "@/components/KeepScoreSlider";
import {
  KEEP_CLASSES,
  KEEP_EMOJI,
  KEEP_HEX,
  KEEP_LABELS,
  KEEP_SCORES,
  computeStats,
  filterItems,
  sortItems,
  type CollectionFilters,
  type CollectionItemView,
  type CollectionSort,
} from "@/lib/collection";
import { formatDateShort, formatDuration, formatRelativeShort } from "@/lib/format";

type View = "list" | "grid" | "shelf";
type Tab = "own" | "unrated" | "wishlist" | "all";

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

const SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: "added", label: "Fecha de alta" },
  { value: "keep", label: "Permanencia" },
  { value: "myRating", label: "Mi nota de BGG" },
  { value: "rank", label: "Rank de BGG" },
  { value: "rating", label: "Valoración de BGG" },
  { value: "plays", label: "Partidas" },
  { value: "year", label: "Año de publicación" },
  { value: "weight", label: "Peso" },
  { value: "name", label: "Nombre" },
];

const VIEWS: { value: View; label: string; icon: string }[] = [
  { value: "list", label: "Lista", icon: "☰" },
  { value: "grid", label: "Cuadrícula", icon: "▦" },
  { value: "shelf", label: "Estantería", icon: "🗄" },
];

const PAGE_SIZE: Record<View, number> = { list: 24, grid: 36, shelf: 48 };

function playersLabel(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}-${max} jugadores`;
  const n = min || max;
  return `${n} jugador${n === 1 ? "" : "es"}`;
}

function weightLabel(w: number): string {
  if (w < 1.5) return "Ligero";
  if (w < 2.5) return "Medio-ligero";
  if (w < 3.5) return "Medio";
  if (w < 4.5) return "Pesado";
  return "Muy pesado";
}

// La portada grande solo llega tras resincronizar con BGG; hasta entonces
// tiramos del thumbnail de siempre.
function cover(item: { image: string | null; thumbnail: string | null }) {
  return item.image || item.thumbnail;
}

export default function CollectionPage() {
  // La colección entera vive aquí; filtrar y ordenar no vuelve al servidor.
  const [all, setAll] = useState<CollectionItemView[] | null>(null);
  const [meta, setMeta] = useState<ApiResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [view, setView] = useState<View>("list");
  const [tab, setTab] = useState<Tab>("own");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CollectionSort>("added");
  const [order, setOrder] = useState<"" | "asc" | "desc">("");
  const [page, setPage] = useState(1);

  const [showFilters, setShowFilters] = useState(false);
  const [keep, setKeep] = useState("");
  const [players, setPlayers] = useState("");
  const [plays, setPlays] = useState("");
  const [myRating, setMyRating] = useState("");
  const [maxRank, setMaxRank] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [onlyShowcased, setOnlyShowcased] = useState(false);

  const [detail, setDetail] = useState<CollectionItemView | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Juegos que acabas de puntuar y que el filtro activo ya no dejaría pasar.
  // Se quedan a la vista hasta que cambies de filtro: si desaparecieran al
  // instante, no podrías corregir la puntuación sin ir a buscarlos.
  const [sticky, setSticky] = useState<Set<number>>(new Set());

  const [linkProgress, setLinkProgress] = useState<{ done: number; total: number } | null>(null);
  const enrichedRef = useRef(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

  // La vista elegida se recuerda entre visitas: es una preferencia estética,
  // no un filtro, y es molesto volver a ponerla cada vez.
  useEffect(() => {
    const saved = localStorage.getItem("collection:view");
    if (saved === "list" || saved === "grid" || saved === "shelf") setView(saved);
  }, []);

  const changeView = (next: View) => {
    setView(next);
    localStorage.setItem("collection:view", next);
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
          showToast(`BGG no ha respondido (${json.syncError}). Te enseñamos lo último que teníamos.`);
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

  // ── Filtro, orden y paginación (todo en local) ────────────────────────

  const filters: CollectionFilters = useMemo(
    () => ({
      status: tab === "wishlist" ? "wishlist" : tab === "all" ? "all" : "own",
      search,
      keep: tab === "unrated" ? "unrated" : keep,
      players: players ? Number(players) : undefined,
      minPlays: plays && plays !== "0" ? Number(plays) : undefined,
      unplayed: plays === "0",
      myRating,
      maxRank: maxRank ? Number(maxRank) : undefined,
      minWeight: minWeight ? Number(minWeight) : undefined,
      maxWeight: maxWeight ? Number(maxWeight) : undefined,
      showcased: onlyShowcased,
    }),
    [tab, search, keep, players, plays, myRating, maxRank, minWeight, maxWeight, onlyShowcased]
  );

  const stats = useMemo(() => (all ? computeStats(all) : null), [all]);

  const visible = useMemo(() => {
    if (!all) return [];
    const matching = filterItems(all, filters);
    if (sticky.size === 0) return sortItems(matching, sort, order);
    const seen = new Set(matching.map((i) => i.bggId));
    const kept = all.filter((i) => sticky.has(i.bggId) && !seen.has(i.bggId));
    return sortItems([...matching, ...kept], sort, order);
  }, [all, filters, sort, order, sticky]);

  const pageSize = PAGE_SIZE[view];
  const totalPages = Math.ceil(visible.length / pageSize);
  const pageItems = useMemo(
    () => visible.slice((page - 1) * pageSize, page * pageSize),
    [visible, page, pageSize]
  );

  // Al cambiar de filtro se vuelve a la primera página y se sueltan los
  // juegos que estaban "pegados" por haberlos puntuado hace un momento.
  useEffect(() => {
    setPage(1);
    setSticky(new Set());
  }, [filters, sort, order, view]);

  // Si la lista encoge (al puntuar dentro de una pestaña que filtra) no
  // puedes quedarte en una página que ya no existe.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    setDetail((prev) => (prev ? apply(prev) : prev));
    setSticky((prev) => new Set(prev).add(bggId));

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

  const toggleExpanded = (bggId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(bggId)) next.delete(bggId);
      else next.add(bggId);
      return next;
    });
  };

  const clearFilters = () => {
    setKeep("");
    setPlayers("");
    setPlays("");
    setMyRating("");
    setMaxRank("");
    setMinWeight("");
    setMaxWeight("");
    setOnlyShowcased(false);
    setSearch("");
  };

  const hasActiveFilters =
    !!keep || !!players || !!plays || !!myRating || !!maxRank || !!minWeight ||
    !!maxWeight || onlyShowcased;

  const loading = all === null;

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

  const TABS: { value: Tab; label: string; count?: number }[] = [
    { value: "own", label: "Los que tengo", count: stats?.owned },
    { value: "unrated", label: "Sin valorar", count: stats?.unrated },
    { value: "wishlist", label: "Los que quiero", count: stats?.wishlist },
    { value: "all", label: "Todos", count: stats?.total },
  ];

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
            <button
              onClick={refreshFromBgg}
              disabled={syncing}
              title="Volver a traer la colección desde BGG"
              className="shrink-0 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 disabled:opacity-50 transition-all duration-200"
            >
              <span className={syncing ? "animate-spin inline-block" : ""}>↻</span>
            </button>
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
              progress={
                linkProgress.total > 0
                  ? linkProgress.done / linkProgress.total
                  : 0
              }
            />
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Resumen por puntuación, que además filtra al pulsarlo */}
          {stats && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                {KEEP_SCORES.map((score) => (
                  <button
                    key={score}
                    onClick={() => {
                      // Estando en "Sin valorar" la pestaña manda sobre este
                      // filtro, así que al pulsar una puntuación salimos de ella.
                      if (tab === "unrated") setTab("own");
                      setKeep((prev) => (prev === String(score) ? "" : String(score)));
                    }}
                    title={KEEP_LABELS[score]}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      keep === String(score)
                        ? KEEP_CLASSES[score]
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text)]"
                    }`}
                  >
                    {KEEP_EMOJI[score]} {stats.byScore[score]}
                  </button>
                ))}
                <span className="ml-auto text-xs text-[var(--text-muted)]">
                  {stats.owned} juegos · {stats.expansions} expansiones
                  {meta?.fetchedAt && ` · al día de ${formatRelativeShort(meta.fetchedAt)}`}
                </span>
              </div>
            </div>
          )}

          {/* Barra de herramientas */}
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {TABS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTab(t.value)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
                      tab === t.value
                        ? "bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/30"
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border-strong)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t.label}
                    {t.count !== undefined && (
                      <span className="ml-1 opacity-60">{t.count}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 shrink-0">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => changeView(v.value)}
                    title={v.label}
                    aria-label={v.label}
                    aria-pressed={view === v.value}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                      view === v.value
                        ? "bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/30"
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border-strong)] hover:text-[var(--text)]"
                    }`}
                  >
                    {v.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar en mi colección..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as CollectionSort);
                    setOrder("");
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  title="Invertir el orden"
                  className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                >
                  {order === "asc" ? "↑" : order === "desc" ? "↓" : "↕"}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="mt-3 flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Filtros
              {hasActiveFilters && (
                <span className="bg-[var(--accent-soft)] text-[var(--primary)] text-xs px-2 py-0.5 rounded-full">
                  Activos
                </span>
              )}
            </button>

            {showFilters && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Puntuación">
                    <Select
                      value={tab === "unrated" ? "unrated" : keep}
                      onChange={setKeep}
                      disabled={tab === "unrated"}
                    >
                      <option value="">Todas</option>
                      <option value="unrated">Sin valorar</option>
                      <option value="rated">Ya valoradas</option>
                      {KEEP_SCORES.map((s) => (
                        <option key={s} value={s}>
                          {s}. {KEEP_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Jugadores">
                    <Select value={players} onChange={setPlayers}>
                      <option value="">Cualquiera</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          Se puede jugar a {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Partidas">
                    <Select value={plays} onChange={setPlays}>
                      <option value="">Cualquiera</option>
                      <option value="0">Sin estrenar</option>
                      <option value="1">1 o más</option>
                      <option value="5">5 o más</option>
                      <option value="10">10 o más</option>
                      <option value="25">25 o más</option>
                    </Select>
                  </Field>
                  <Field label="Mi nota de BGG">
                    <Select value={myRating} onChange={setMyRating}>
                      <option value="">Indiferente</option>
                      <option value="yes">Con nota mía</option>
                      <option value="no">Sin nota mía</option>
                    </Select>
                  </Field>
                  <Field label="Rank de BGG">
                    <Select value={maxRank} onChange={setMaxRank}>
                      <option value="">Cualquiera</option>
                      <option value="100">Top 100</option>
                      <option value="250">Top 250</option>
                      <option value="500">Top 500</option>
                      <option value="1000">Top 1000</option>
                    </Select>
                  </Field>
                  <Field label="Peso">
                    <div className="flex gap-1">
                      <Select value={minWeight} onChange={setMinWeight}>
                        <option value="">Desde</option>
                        <option value="1">1+</option>
                        <option value="2">2+</option>
                        <option value="3">3+</option>
                        <option value="4">4+</option>
                      </Select>
                      <Select value={maxWeight} onChange={setMaxWeight}>
                        <option value="">Hasta</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </Select>
                    </div>
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => setOnlyShowcased(!onlyShowcased)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      onlyShowcased
                        ? "bg-[var(--accent-soft)] text-[var(--primary)] border-[var(--primary)]/40"
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text)]"
                    }`}
                  >
                    ⭐ Solo los de mi vitrina
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="px-3 py-1.5 bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-lg text-xs hover:text-[var(--text)] transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Contador */}
          {!loading && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {visible.length} juego{visible.length !== 1 ? "s" : ""}
                {search && ` para “${search}”`}
              </p>
              {totalPages > 1 && (
                <p className="text-sm text-[var(--text-muted)]">
                  Página {page} de {totalPages}
                </p>
              )}
            </div>
          )}

          {/* Resultados */}
          {loading || firstSync ? (
            <Skeleton view={view} />
          ) : pageItems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--text-muted)]">
                {tab === "unrated"
                  ? "¡No te queda ninguno por valorar! 🎉"
                  : "No hay juegos que encajen"}
              </p>
              {(hasActiveFilters || search) && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm text-[var(--primary)] hover:underline"
                >
                  Quitar los filtros
                </button>
              )}
            </div>
          ) : view === "shelf" ? (
            <ShelfView items={pageItems} onOpen={setDetail} />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {pageItems.map((item) => (
                <GridCard
                  key={item.bggId}
                  item={item}
                  onOpen={() => setDetail(item)}
                  onScore={(score) => saveEntry(item.bggId, { keepScore: score })}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {pageItems.map((item) => (
                <ListRow
                  key={item.bggId}
                  item={item}
                  expanded={expanded.has(item.bggId)}
                  onToggleExpanded={() => toggleExpanded(item.bggId)}
                  onOpen={() => setDetail(item)}
                  onScore={(score) => saveEntry(item.bggId, { keepScore: score })}
                />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={page === 1}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] disabled:opacity-40 disabled:hover:text-[var(--text-secondary)] transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-[var(--text-muted)] px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={page === totalPages}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] disabled:opacity-40 disabled:hover:text-[var(--text-secondary)] transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <DetailModal
          item={detail}
          onClose={() => setDetail(null)}
          onScore={(score) => saveEntry(detail.bggId, { keepScore: score })}
          onExpansionScore={(bggId, score) => saveEntry(bggId, { keepScore: score })}
          onToggleShowcase={() =>
            saveEntry(detail.bggId, { showcased: !detail.showcased })
          }
        />
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

// ── Piezas sueltas de la interfaz ───────────────────────────────────────

// Aviso de "esto está pasando ahora", con barra de avance opcional.
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

// Esqueleto con la forma de la vista activa: así la página no salta cuando
// llegan los datos y se entiende de un vistazo qué se está cargando.
function Skeleton({ view }: { view: View }) {
  if (view === "shelf") {
    return (
      <div className="shelf-wrap">
        <div className="shelf">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="shelf-slot">
              <div className="shelf-box w-[72px] h-[92px] bg-black/20 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-[var(--surface-hover)]" />
            <div className="p-2.5 space-y-2">
              <div className="h-3 w-3/4 rounded bg-[var(--surface-hover)]" />
              <div className="h-2 w-1/2 rounded bg-[var(--surface-hover)]" />
              <div className="h-1.5 w-full rounded bg-[var(--surface-hover)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-3 animate-pulse"
        >
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded-xl bg-[var(--surface-hover)] shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3.5 w-1/3 rounded bg-[var(--surface-hover)]" />
              <div className="h-2.5 w-2/3 rounded bg-[var(--surface-hover)]" />
            </div>
            <div className="hidden sm:block w-44 h-6 self-center rounded bg-[var(--surface-hover)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1.5 font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  disabled = false,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none disabled:opacity-60 transition-all duration-200"
    >
      {children}
    </select>
  );
}

// Mi nota personal de BGG, marcada como propia para no confundirla con la
// media de la comunidad.
function MyRatingBadge({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/30"
      title={`Tu nota en BGG: ${rating}`}
    >
      ★ {rating % 1 === 0 ? rating : rating.toFixed(1)}
    </span>
  );
}

function Meta({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] whitespace-nowrap"
    >
      {children}
    </span>
  );
}

function GameMeta({ item }: { item: CollectionItemView }) {
  const players = playersLabel(item.minPlayers, item.maxPlayers);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.yearPublished && <Meta>{item.yearPublished}</Meta>}
      {players && <Meta title={item.bestWith ? `Mejor con ${item.bestWith}` : undefined}>{players}</Meta>}
      {item.playingTime ? <Meta>{formatDuration(item.playingTime)}</Meta> : null}
      {item.weight ? <Meta title={`Peso ${item.weight.toFixed(1)}/5`}>{weightLabel(item.weight)}</Meta> : null}
      {item.bggRank && <Meta title="Puesto en el ranking de BGG">#{item.bggRank}</Meta>}
      <Meta title="Partidas registradas en BGG">
        🎲 {item.numPlays}
        {item.expansionPlays > 0 && ` (+${item.expansionPlays})`}
      </Meta>
      {item.dateAdded && (
        <Meta title="Fecha de alta en tu colección de BGG">
          {formatDateShort(item.dateAdded)}
        </Meta>
      )}
    </div>
  );
}

function ListRow({
  item,
  expanded,
  onToggleExpanded,
  onOpen,
  onScore,
}: {
  item: CollectionItemView;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpen: () => void;
  onScore: (score: number | null) => void;
}) {
  const thumb = item.thumbnail;
  return (
    <div
      className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-3"
      style={
        item.keepScore
          ? { borderLeft: `3px solid ${KEEP_HEX[item.keepScore]}` }
          : undefined
      }
    >
      <div className="flex gap-3">
        <button
          onClick={onOpen}
          className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-[var(--surface-hover)] flex items-center justify-center"
          title="Ver la ficha"
        >
          {thumb ? (
            <Image src={thumb} alt={item.name} width={56} height={56} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">🎲</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button onClick={onOpen} className="text-left min-w-0 flex-1">
              <h3 className="font-semibold text-sm text-[var(--text)] truncate hover:text-[var(--primary)] transition-colors">
                {item.name}
              </h3>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.showcased && <span title="En la vitrina de tu perfil">⭐</span>}
              {item.status === "wishlist" && (
                <Meta title="Está en tu wishlist de BGG">Lo quiero</Meta>
              )}
              {item.userRating !== null && <MyRatingBadge rating={item.userRating} />}
              {item.bggRating !== null && <BggRating rating={item.bggRating} size={28} />}
            </div>
          </div>

          <div className="mt-1.5">
            <GameMeta item={item} />
          </div>

          {item.expansions.length > 0 && (
            <button
              onClick={onToggleExpanded}
              className="mt-1.5 text-[11px] text-[var(--primary)] hover:underline"
            >
              {expanded ? "▾" : "▸"} {item.expansions.length} expansi
              {item.expansions.length === 1 ? "ón" : "ones"}
            </button>
          )}

          {expanded && item.expansions.length > 0 && (
            <ul className="mt-1.5 space-y-1 border-l border-[var(--border)] pl-3">
              {item.expansions.map((exp) => (
                <li
                  key={exp.bggId}
                  className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]"
                >
                  <span className="truncate">{exp.name}</span>
                  <span className="shrink-0 flex items-center gap-1.5 text-[var(--text-muted)]">
                    {exp.numPlays > 0 && <span>🎲 {exp.numPlays}</span>}
                    {exp.ownKeepScore ? (
                      <span
                        title={`Puntuación propia: ${KEEP_LABELS[exp.ownKeepScore]}`}
                        style={{ color: KEEP_HEX[exp.ownKeepScore] }}
                      >
                        {KEEP_EMOJI[exp.ownKeepScore]}
                      </span>
                    ) : item.keepScore ? (
                      <span title={`Hereda: ${KEEP_LABELS[item.keepScore]}`} className="opacity-60">
                        {KEEP_EMOJI[item.keepScore]}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden sm:block w-44 shrink-0 self-center">
          <KeepScoreSlider value={item.keepScore} onChange={onScore} />
        </div>
      </div>

      <div className="sm:hidden mt-2">
        <KeepScoreSlider value={item.keepScore} onChange={onScore} />
      </div>
    </div>
  );
}

function GridCard({
  item,
  onOpen,
  onScore,
}: {
  item: CollectionItemView;
  onOpen: () => void;
  onScore: (score: number | null) => void;
}) {
  const img = cover(item);
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] overflow-hidden flex flex-col">
      <button onClick={onOpen} className="relative aspect-square bg-[var(--surface-hover)]">
        {img ? (
          <Image src={img} alt={item.name} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-3xl">🎲</span>
        )}
        {item.keepScore && (
          <span
            className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow"
            style={{ backgroundColor: KEEP_HEX[item.keepScore] }}
            title={KEEP_LABELS[item.keepScore]}
          >
            {KEEP_EMOJI[item.keepScore]}
          </span>
        )}
        {item.showcased && <span className="absolute top-2 right-2 text-sm">⭐</span>}
      </button>
      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
        <button onClick={onOpen} className="text-left">
          <h3 className="text-xs font-semibold text-[var(--text)] line-clamp-2 hover:text-[var(--primary)] transition-colors">
            {item.name}
          </h3>
        </button>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>🎲 {item.numPlays}</span>
          {item.userRating !== null && <span className="text-[var(--primary)]">★ {item.userRating}</span>}
          {item.expansions.length > 0 && <span>+{item.expansions.length} exp.</span>}
        </div>
        <div className="mt-auto pt-1">
          <KeepScoreSlider value={item.keepScore} onChange={onScore} compact />
        </div>
      </div>
    </div>
  );
}

// La vitrina: las cajas apoyadas en baldas de madera. Aquí no se puntúa, se
// mira; para puntuar se abre la ficha del juego.
function ShelfView({
  items,
  onOpen,
}: {
  items: CollectionItemView[];
  onOpen: (item: CollectionItemView) => void;
}) {
  return (
    <div className="shelf-wrap">
      <div className="shelf">
        {items.map((item) => {
          const img = cover(item);
          return (
            <div key={item.bggId} className="shelf-slot">
              <button
                onClick={() => onOpen(item)}
                className="shelf-item relative flex items-end justify-center max-w-full focus:outline-none"
                title={`${item.name}${item.keepScore ? ` — ${KEEP_LABELS[item.keepScore]}` : ""}`}
              >
                {img ? (
                  <Image
                    src={img}
                    alt={item.name}
                    width={220}
                    height={220}
                    sizes="(max-width: 640px) 33vw, 120px"
                    className="shelf-box"
                  />
                ) : (
                  <span className="shelf-box flex items-end justify-center w-16 h-20 bg-[var(--surface-hover)] text-2xl">
                    🎲
                  </span>
                )}
                {item.keepScore && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white/70 shadow"
                    style={{ backgroundColor: KEEP_HEX[item.keepScore] }}
                  />
                )}
                {item.showcased && (
                  <span className="absolute -top-2 -left-1 text-xs drop-shadow">⭐</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailModal({
  item,
  onClose,
  onScore,
  onExpansionScore,
  onToggleShowcase,
}: {
  item: CollectionItemView;
  onClose: () => void;
  onScore: (score: number | null) => void;
  onExpansionScore: (bggId: number, score: number | null) => void;
  onToggleShowcase: () => void;
}) {
  const img = cover(item);

  // Cerrar con Escape: la ficha se abre y se cierra muchas veces seguidas
  // mientras repasas la colección.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-[var(--surface-hover)] flex items-center justify-center">
              {img ? (
                <Image src={img} alt={item.name} width={96} height={96} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">🎲</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[var(--text)] leading-snug">{item.name}</h2>
              <div className="mt-2">
                <GameMeta item={item} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                {item.bggRating !== null && <BggRating rating={item.bggRating} size={30} />}
                {item.userRating !== null && <MyRatingBadge rating={item.userRating} />}
                <a
                  href={`https://boardgamegeek.com/boardgame/${item.bggId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--primary)] hover:underline"
                >
                  Ver en BGG ↗
                </a>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              ¿Se queda en tu colección?
            </p>
            <KeepScoreSlider value={item.keepScore} onChange={onScore} />
          </div>

          {item.expansions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Expansiones · heredan la puntuación del juego base salvo que les
                des una propia
              </p>
              <div className="space-y-2">
                {item.expansions.map((exp) => (
                  <div
                    key={exp.bggId}
                    className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-[var(--text)] truncate">{exp.name}</span>
                      {exp.numPlays > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                          🎲 {exp.numPlays}
                        </span>
                      )}
                    </div>
                    <KeepScoreSlider
                      value={exp.ownKeepScore ?? item.keepScore}
                      onChange={(score) => onExpansionScore(exp.bggId, score)}
                      inherited={exp.ownKeepScore === null}
                      inheritedFrom={item.name}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onToggleShowcase}
            className={`mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              item.showcased
                ? "bg-[var(--accent-soft)] text-[var(--primary)] border-[var(--primary)]/40"
                : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text)]"
            }`}
          >
            {item.showcased ? "⭐ En la vitrina de tu perfil" : "☆ Añadir a la vitrina de tu perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}
