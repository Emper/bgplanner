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
import { readStorage, writeStorage } from "@/lib/storage";
import { plural } from "@/lib/text";
import {
  CollectionSkeleton,
  DetailModal,
  GridCard,
  ListRow,
  type CollectionView,
} from "@/components/CollectionViews";
import GameShelf from "@/components/GameShelf";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import Spinner from "@/components/ui/Spinner";
import { Chip, SegmentedControl } from "@/components/ui/Tabs";

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
  const value = readStorage(VIEW_KEY);
  return value === "list" || value === "grid" || value === "shelf" ? value : null;
}

function writeStoredView(value: CollectionView) {
  writeStorage(VIEW_KEY, value);
  for (const listener of viewListeners) listener();
}

interface Props {
  /** null mientras se carga. */
  items: CollectionItemView[] | null;
  /** Fuerza el esqueleto aunque ya haya datos (primera sincronización). */
  loading?: boolean;
  /** Sin sliders: la colección es de otro y solo se consulta. */
  readOnly?: boolean;
  /**
   * Sin rastro de la permanencia, que es privada: la colección de alguien
   * que no te tiene entre sus amigos. Las puntuaciones ya llegan vacías del
   * servidor; esto quita lo que las enseña, ordena o filtra.
   */
  hideScores?: boolean;
  /** Nombre del dueño, para los textos de la vista compartida. */
  owner?: string;
  /** Cuándo se trajo la colección de BGG por última vez. */
  fetchedAt?: string | null;
  onScore?: (bggId: number, score: number | null) => void;
  onToggleShowcase?: (bggId: number) => void;
  /** Quitar un juego de la wishlist de BG Planner. */
  onRemoveSaved?: (bggId: number) => void;
}

/**
 * Todo el aparato de mirar una colección: pestañas, búsqueda, filtros,
 * orden, las tres vistas y el scroll infinito. Lo comparten "Mi colección"
 * (donde además se puntúa) y la colección de otro desde su perfil.
 */
export default function CollectionBrowser({
  items,
  loading = false,
  readOnly = false,
  hideScores = false,
  owner,
  fetchedAt,
  onScore,
  onToggleShowcase,
  onRemoveSaved,
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
  const sortOptions = hideScores
    ? SORT_OPTIONS.filter((o) => o.value !== "keep")
    : SORT_OPTIONS;
  const [tab, setTab] = useState<Tab>(() => {
    const t = initial.get("tab");
    if (t === "unrated") return hideScores ? "own" : t;
    return t === "wishlist" || t === "all" ? t : "own";
  });
  const [search, setSearch] = useState(() => initial.get("q") ?? "");
  const [sort, setSort] = useState<CollectionSort>(() => {
    const value = initial.get("sort");
    return sortOptions.some((o) => o.value === value)
      ? (value as CollectionSort)
      : "added";
  });
  const [order, setOrder] = useState<"" | "asc" | "desc">(() => {
    const o = initial.get("order");
    return o === "asc" || o === "desc" ? o : "";
  });
  const [limit, setLimit] = useState(24);

  const [showFilters, setShowFilters] = useState(false);
  const [keep, setKeep] = useState(() => (hideScores ? "" : initial.get("keep") ?? ""));
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
    ...(hideScores
      ? []
      : [{ value: "unrated" as const, label: "Sin valorar", count: stats?.unrated }]),
    { value: "wishlist", label: readOnly ? "Los que quiere" : "Los que quiero", count: stats?.wishlist },
    { value: "all", label: "Todos", count: stats?.total },
  ];

  return (
    <>
      {/* Resumen por puntuación, que además filtra al pulsarlo */}
      {stats && (
        <div className={cardClass({ className: "mb-4" })}>
          {!hideScores && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {KEEP_SCORES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={keep === String(value)}
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
                  <span aria-hidden>{KEEP_EMOJI[value]}</span>
                  <span>{KEEP_LABELS[value]}</span>
                  <span className="opacity-60 tabular-nums">{stats.byScore[value]}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            {plural(stats.owned, "juego", "juegos")} · {plural(stats.expansions, "expansión", "expansiones")}
            {fetchedAt && ` · al día de ${formatRelativeShort(fetchedAt)}`}
          </p>
        </div>
      )}

      {/* Barra de herramientas */}
      <div className={cardClass({ className: "mb-4" })}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <Chip
                key={t.value}
                size="sm"
                active={tab === t.value}
                count={t.count}
                onClick={() => setTab(t.value)}
                className="sm:px-3 sm:py-1.5"
              >
                {t.label}
              </Chip>
            ))}
          </div>
          <SegmentedControl
            size="sm"
            label="Vista"
            value={view}
            onChange={changeView}
            className="shrink-0"
            options={VIEWS.map((v) => ({
              value: v.value,
              title: v.label,
              label: (
                <>
                  <span aria-hidden>{v.icon}</span>
                  <span className="sr-only">{v.label}</span>
                </>
              ),
            }))}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              type="text"
              placeholder="Buscar juegos…"
              aria-label="Buscar juegos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={sort}
              aria-label="Ordenar por"
              onChange={(e) => {
                setSort(e.target.value as CollectionSort);
                setOrder("");
              }}
              className="flex-1 sm:flex-none sm:w-auto"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              onClick={() => setOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              title="Invertir el orden"
              aria-label="Invertir el orden"
            >
              {order === "asc" ? "↑" : order === "desc" ? "↓" : "↕"}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          className="mt-3 flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
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
              {!hideScores && (
                <FilterSelect
                  label="Puntuación"
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
                </FilterSelect>
              )}
              <FilterSelect label="Jugadores" value={players} onChange={setPlayers}>
                <option value="">Cualquiera</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    Se puede jugar a {n}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Partidas" value={plays} onChange={setPlays}>
                <option value="">Cualquiera</option>
                <option value="0">Sin estrenar</option>
                <option value="1">1 o más</option>
                <option value="5">5 o más</option>
                <option value="10">10 o más</option>
                <option value="25">25 o más</option>
              </FilterSelect>
              <FilterSelect label={readOnly ? "Nota de BGG propia" : "Mi nota de BGG"} value={myRating} onChange={setMyRating}>
                <option value="">Indiferente</option>
                <option value="yes">Con nota</option>
                <option value="no">Sin nota</option>
              </FilterSelect>
              <FilterSelect label="Rank de BGG" value={maxRank} onChange={setMaxRank}>
                <option value="">Cualquiera</option>
                <option value="100">Top 100</option>
                <option value="250">Top 250</option>
                <option value="500">Top 500</option>
                <option value="1000">Top 1000</option>
              </FilterSelect>
              <Field label="Peso">
                {(id) => (
                  <div className="flex gap-1">
                    <Select id={id} size="sm" aria-label="Peso mínimo" value={minWeight} onChange={(e) => setMinWeight(e.target.value)}>
                      <option value="">Desde</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                      <option value="4">4+</option>
                    </Select>
                    <Select size="sm" aria-label="Peso máximo" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)}>
                      <option value="">Hasta</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </Select>
                  </div>
                )}
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Chip size="sm" active={onlyShowcased} onClick={() => setOnlyShowcased(!onlyShowcased)} className="sm:px-3 sm:py-1.5">
                ⭐ Solo los de la vitrina
              </Chip>
              {hasActiveFilters && (
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contador */}
      {!showSkeleton && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {plural(visible.length, "juego", "juegos")}
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
        <EmptyState
          className="py-16"
          title={
            tab === "unrated" && !readOnly
              ? "¡No te queda ninguno por valorar! 🎉"
              : "No hay juegos que encajen"
          }
          action={
            (hasActiveFilters || search) && (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Quitar los filtros
              </Button>
            )
          }
        />
      ) : view === "shelf" ? (
        <GameShelf games={shown} onSelect={(game) => setDetailId(game.bggId)} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {shown.map((item) => (
            <GridCard
              key={item.bggId}
              item={item}
              readOnly={readOnly}
              hideScores={hideScores}
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
              hideScores={hideScores}
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
            <Spinner size="xs" tone="muted" />
            Cargando más juegos…
          </div>
          <Button variant="secondary" onClick={() => setLimit((l) => l + BATCH[view])}>
            Cargar más
          </Button>
        </div>
      )}

      {!showSkeleton && !hasMore && visible.length > BATCH[view] && (
        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          Has llegado al final · {plural(visible.length, "juego", "juegos")}
        </p>
      )}

      {detail && (
        <DetailModal
          item={detail}
          readOnly={readOnly}
          hideScores={hideScores}
          owner={owner}
          onClose={() => setDetailId(null)}
          onScore={(value) => score(detail.bggId, value)}
          onExpansionScore={(bggId, value) => score(bggId, value)}
          onToggleShowcase={() => showcase(detail.bggId)}
          onRemoveSaved={
            onRemoveSaved && detail.savedHere
              ? () => {
                  onRemoveSaved(detail.bggId);
                  setDetailId(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

// ── Campos del panel de filtros ─────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <Select id={id} size="sm" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {children}
        </Select>
      )}
    </Field>
  );
}
