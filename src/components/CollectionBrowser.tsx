"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  KEEP_CLASSES,
  KEEP_EMOJI,
  KEEP_LABELS,
  KEEP_SCORES,
  computeStats,
  filterItems,
  sortItems,
  type CollectionFilters,
  type CollectionItemView,
  type CollectionSort,
} from "@/lib/collection";
import { formatRelativeShort } from "@/lib/format";
import {
  CollectionSkeleton,
  DetailModal,
  GridCard,
  ListRow,
  ShelfView,
  type CollectionView,
} from "@/components/CollectionViews";

type Tab = "own" | "unrated" | "wishlist" | "all";

const SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: "added", label: "Fecha de alta" },
  { value: "keep", label: "Permanencia" },
  { value: "myRating", label: "Nota de BGG propia" },
  { value: "rank", label: "Rank de BGG" },
  { value: "rating", label: "Valoración de BGG" },
  { value: "plays", label: "Partidas" },
  { value: "year", label: "Año de publicación" },
  { value: "weight", label: "Peso" },
  { value: "name", label: "Nombre" },
];

const VIEWS: { value: CollectionView; label: string; icon: string }[] = [
  { value: "list", label: "Lista", icon: "☰" },
  { value: "grid", label: "Cuadrícula", icon: "▦" },
  { value: "shelf", label: "Estantería", icon: "🗄" },
];

// Cuántas fichas se añaden cada vez que el scroll llega al final.
const BATCH: Record<CollectionView, number> = { list: 24, grid: 36, shelf: 48 };

// ── Vista preferida, recordada en el navegador ──────────────────────────
// Va por useSyncExternalStore y no por un efecto: en el servidor no hay
// localStorage, así que se pinta la vista por defecto y React aplica la
// guardada al hidratar, sin un setState de más ni aviso de hidratación.

const VIEW_KEY = "collection:view";
let viewListeners: (() => void)[] = [];

function subscribeStoredView(callback: () => void) {
  viewListeners.push(callback);
  return () => {
    viewListeners = viewListeners.filter((l) => l !== callback);
  };
}

function readStoredView(): CollectionView | null {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return value === "list" || value === "grid" || value === "shelf" ? value : null;
  } catch {
    // Navegador con el almacenamiento capado: nos quedamos sin preferencia.
    return null;
  }
}

function writeStoredView(value: CollectionView) {
  try {
    localStorage.setItem(VIEW_KEY, value);
  } catch {
    // Igual que arriba: no poder recordarla no es motivo para romper nada.
  }
  for (const listener of viewListeners) listener();
}

interface Props {
  /** null mientras se carga. */
  items: CollectionItemView[] | null;
  /** Fuerza el esqueleto aunque ya haya datos (primera sincronización). */
  loading?: boolean;
  /** Sin sliders: la colección es de otro y solo se consulta. */
  readOnly?: boolean;
  /** Nombre del dueño, para los textos de la vista compartida. */
  owner?: string;
  /** Cuándo se trajo la colección de BGG por última vez. */
  fetchedAt?: string | null;
  onScore?: (bggId: number, score: number | null) => void;
  onToggleShowcase?: (bggId: number) => void;
}

/**
 * Todo el aparato de mirar una colección: pestañas, búsqueda, filtros,
 * orden, las tres vistas y el scroll infinito. Lo comparten "Mi colección"
 * (donde además se puntúa) y la colección que alguien comparte contigo.
 */
export default function CollectionBrowser({
  items,
  loading = false,
  readOnly = false,
  owner,
  fetchedAt,
  onScore,
  onToggleShowcase,
}: Props) {
  // Lo que estás mirando viaja en la URL: así puedes recargar, compartir el
  // enlace o volver atrás sin perder los filtros.
  // Los inicializadores perezosos de useState solo corren en el primer
  // render, así que leer aquí los parámetros da el estado de partida sin
  // que cambiarlos luego nos pise lo que el usuario vaya tocando.
  const initial = useSearchParams();

  const storedView = useSyncExternalStore(
    subscribeStoredView,
    readStoredView,
    () => null
  );
  const [chosenView, setChosenView] = useState<CollectionView | null>(() => {
    const v = initial.get("view");
    return v === "grid" || v === "shelf" || v === "list" ? v : null;
  });
  // Manda lo que diga el enlace; si no, lo último que eligió este navegador.
  const view: CollectionView = chosenView ?? storedView ?? "list";
  const [tab, setTab] = useState<Tab>(() => {
    const t = initial.get("tab");
    return t === "unrated" || t === "wishlist" || t === "all" ? t : "own";
  });
  const [search, setSearch] = useState(() => initial.get("q") ?? "");
  const [sort, setSort] = useState<CollectionSort>(() => {
    const value = initial.get("sort");
    return SORT_OPTIONS.some((o) => o.value === value)
      ? (value as CollectionSort)
      : "added";
  });
  const [order, setOrder] = useState<"" | "asc" | "desc">(() => {
    const o = initial.get("order");
    return o === "asc" || o === "desc" ? o : "";
  });
  const [limit, setLimit] = useState(24);

  const [showFilters, setShowFilters] = useState(false);
  const [keep, setKeep] = useState(() => initial.get("keep") ?? "");
  const [players, setPlayers] = useState(() => initial.get("players") ?? "");
  const [plays, setPlays] = useState(() => initial.get("plays") ?? "");
  const [myRating, setMyRating] = useState(() => initial.get("mine") ?? "");
  const [maxRank, setMaxRank] = useState(() => initial.get("rank") ?? "");
  const [minWeight, setMinWeight] = useState(() => initial.get("wmin") ?? "");
  const [maxWeight, setMaxWeight] = useState(() => initial.get("wmax") ?? "");
  const [onlyShowcased, setOnlyShowcased] = useState(
    () => initial.get("star") === "1"
  );

  // El detalle se guarda por id, no por objeto, para que la ficha abierta
  // refleje al instante lo que acabas de puntuar.
  const [detailId, setDetailId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Juegos que acabas de puntuar y que el filtro activo ya no dejaría pasar.
  // Se quedan a la vista hasta que cambies de filtro: si desaparecieran al
  // instante, no podrías corregir la puntuación sin ir a buscarlos.
  const [sticky, setSticky] = useState<Set<number>>(new Set());

  const changeView = (next: CollectionView) => {
    setChosenView(next);
    writeStoredView(next);
  };

  // Vuelca el estado a la barra de direcciones. Se usa replaceState en vez
  // del router para que tocar un filtro no re-renderice el árbol de
  // servidor ni llene el historial de pasos atrás; solo se escriben los
  // valores distintos del de por defecto, para que el enlace quede legible.
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "own") params.set("tab", tab);
    if (view !== "list") params.set("view", view);
    if (search.trim()) params.set("q", search.trim());
    if (sort !== "added") params.set("sort", sort);
    if (order) params.set("order", order);
    if (keep) params.set("keep", keep);
    if (players) params.set("players", players);
    if (plays) params.set("plays", plays);
    if (myRating) params.set("mine", myRating);
    if (maxRank) params.set("rank", maxRank);
    if (minWeight) params.set("wmin", minWeight);
    if (maxWeight) params.set("wmax", maxWeight);
    if (onlyShowcased) params.set("star", "1");

    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", url);
    }
  }, [
    tab, view, search, sort, order, keep, players, plays, myRating,
    maxRank, minWeight, maxWeight, onlyShowcased,
  ]);

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

  const stats = useMemo(() => (items ? computeStats(items) : null), [items]);

  const visible = useMemo(() => {
    if (!items) return [];
    const matching = filterItems(items, filters);
    if (sticky.size === 0) return sortItems(matching, sort, order);
    const seen = new Set(matching.map((i) => i.bggId));
    const kept = items.filter((i) => sticky.has(i.bggId) && !seen.has(i.bggId));
    return sortItems([...matching, ...kept], sort, order);
  }, [items, filters, sort, order, sticky]);

  const shown = useMemo(() => visible.slice(0, limit), [visible, limit]);
  const hasMore = limit < visible.length;
  const detail = detailId !== null
    ? (items?.find((i) => i.bggId === detailId) ?? null)
    : null;

  // Al cambiar de filtro se vuelve al principio de la lista y se sueltan
  // los juegos que estaban "pegados" por haberlos puntuado hace un momento.
  // Se ajusta durante el render comparando con el estado anterior (el patrón
  // que recomienda React) en vez de con un efecto, que daría un render de
  // más con la lista larga todavía pintada.
  const resetKey = [
    tab, search, keep, players, plays, myRating, maxRank, minWeight,
    maxWeight, onlyShowcased, sort, order, view,
  ].join("|");
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setLimit(BATCH[view]);
    setSticky(new Set());
  }

  // Scroll infinito. El observador se vuelve a crear al crecer `limit`, así
  // que si el centinela sigue a la vista (pantallas altas, tandas cortas)
  // dispara otra vez hasta llenar la pantalla, y para en cuanto no queda
  // nada por enseñar.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((l) => l + BATCH[view]);
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, limit, view]);

  const score = (bggId: number, value: number | null) => {
    setSticky((prev) => new Set(prev).add(bggId));
    onScore?.(bggId, value);
  };

  const showcase = (bggId: number) => {
    setSticky((prev) => new Set(prev).add(bggId));
    onToggleShowcase?.(bggId);
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

  const showSkeleton = items === null || loading;

  const TABS: { value: Tab; label: string; count?: number }[] = [
    { value: "own", label: readOnly ? "Los que tiene" : "Los que tengo", count: stats?.owned },
    { value: "unrated", label: "Sin valorar", count: stats?.unrated },
    { value: "wishlist", label: readOnly ? "Los que quiere" : "Los que quiero", count: stats?.wishlist },
    { value: "all", label: "Todos", count: stats?.total },
  ];

  return (
    <>
      {/* Resumen por puntuación, que además filtra al pulsarlo */}
      {stats && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {KEEP_SCORES.map((value) => (
              <button
                key={value}
                onClick={() => {
                  // Estando en "Sin valorar" la pestaña manda sobre este
                  // filtro, así que al pulsar una puntuación salimos de ella.
                  if (tab === "unrated") setTab("own");
                  setKeep((prev) => (prev === String(value) ? "" : String(value)));
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  keep === String(value)
                    ? KEEP_CLASSES[value]
                    : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text)]"
                }`}
              >
                <span>{KEEP_EMOJI[value]}</span>
                <span>{KEEP_LABELS[value]}</span>
                <span className="opacity-60 tabular-nums">{stats.byScore[value]}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            {stats.owned} juegos · {stats.expansions} expansiones
            {fetchedAt && ` · al día de ${formatRelativeShort(fetchedAt)}`}
          </p>
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
              placeholder="Buscar juegos..."
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
              <Field label={readOnly ? "Nota de BGG propia" : "Mi nota de BGG"}>
                <Select value={myRating} onChange={setMyRating}>
                  <option value="">Indiferente</option>
                  <option value="yes">Con nota</option>
                  <option value="no">Sin nota</option>
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
                ⭐ Solo los de la vitrina
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
      {!showSkeleton && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {visible.length} juego{visible.length !== 1 ? "s" : ""}
            {search && ` para “${search}”`}
          </p>
          {hasMore && (
            <p className="text-sm text-[var(--text-muted)]">Viendo {shown.length}</p>
          )}
        </div>
      )}

      {/* Resultados */}
      {showSkeleton ? (
        <CollectionSkeleton view={view} />
      ) : shown.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--text-muted)]">
            {tab === "unrated" && !readOnly
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
        <ShelfView items={shown} onOpen={(item) => setDetailId(item.bggId)} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {shown.map((item) => (
            <GridCard
              key={item.bggId}
              item={item}
              readOnly={readOnly}
              onOpen={() => setDetailId(item.bggId)}
              onScore={(value) => score(item.bggId, value)}
              onToggleShowcase={onToggleShowcase ? () => showcase(item.bggId) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((item) => (
            <ListRow
              key={item.bggId}
              item={item}
              readOnly={readOnly}
              owner={owner}
              expanded={expanded.has(item.bggId)}
              onToggleExpanded={() => toggleExpanded(item.bggId)}
              onOpen={() => setDetailId(item.bggId)}
              onScore={(value) => score(item.bggId, value)}
              onToggleShowcase={onToggleShowcase ? () => showcase(item.bggId) : undefined}
            />
          ))}
        </div>
      )}

      {/* Final de la lista: el centinela del scroll infinito, con botón
          por si el navegador no dispara el observador. */}
      {hasMore && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-3 mt-6">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin" />
            Cargando más juegos…
          </div>
          <button
            onClick={() => setLimit((l) => l + BATCH[view])}
            className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
          >
            Cargar más
          </button>
        </div>
      )}

      {!showSkeleton && !hasMore && visible.length > BATCH[view] && (
        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          Has llegado al final · {visible.length} juegos
        </p>
      )}

      {detail && (
        <DetailModal
          item={detail}
          readOnly={readOnly}
          owner={owner}
          onClose={() => setDetailId(null)}
          onScore={(value) => score(detail.bggId, value)}
          onExpansionScore={(bggId, value) => score(bggId, value)}
          onToggleShowcase={() => showcase(detail.bggId)}
        />
      )}
    </>
  );
}

// ── Campos del panel de filtros ─────────────────────────────────────────

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
