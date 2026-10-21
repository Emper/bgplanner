"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Navbar from "@/components/Navbar";
import BggRating from "@/components/BggRating";
import GameTags, { GameTag } from "@/components/GameTags";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, LABEL_CLASS, Select } from "@/components/ui/Field";
import GameThumb from "@/components/ui/GameThumb";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import Spinner, { InlineLoading } from "@/components/ui/Spinner";
import { Chip } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { bggGameUrl } from "@/lib/bggLinks";
import { plural } from "@/lib/text";
import { displayName } from "@/lib/users";

interface ExpansionItem {
  bggId: number;
  name: string;
  thumbnail: string | null;
}

interface CollectionItem {
  bggId: number;
  name: string;
  thumbnail: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  bggRating: number | null;
  bggRank: number | null;
  weight: number | null;
  numPlays: number;
  userRating: number | null;
  dateAdded: string | null;
  expansions: ExpansionItem[];
}

interface PaginatedResponse {
  items: CollectionItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Resultado de búsqueda en todo BGG (fuera de la colección). `owners` son
// los nombres de los miembros del grupo que lo tienen; vacío = nadie lo tiene.
interface GlobalResult {
  bggId: number;
  name: string;
  yearPublished: number | null;
  thumbnail?: string | null;
  owners: string[];
}

interface Member {
  role: string;
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    surname: string | null;
    bggUsername: string | null;
  };
}

interface GroupData {
  members: Member[];
}

const SORT_OPTIONS = [
  { value: "added", label: "Recientes", icon: "🆕" },
  { value: "rank", label: "Rank BGG", icon: "🏆" },
  { value: "rating", label: "Valoración", icon: "⭐" },
  { value: "weight", label: "Peso", icon: "⚖️" },
  { value: "plays", label: "Partidas", icon: "🎲" },
  { value: "name", label: "Nombre", icon: "🔤" },
  { value: "year", label: "Año", icon: "📅" },
];

const PAGE_SIZE = 24;

// Hacia dónde ordena cada criterio si no se ha dado la vuelta.
const DEFAULT_SORT_DIR: Record<string, "asc" | "desc"> = {
  added: "desc", rank: "asc", rating: "desc", weight: "asc",
  name: "asc", plays: "desc", year: "desc",
};

export default function AddGamesPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("user") || "";

  const [group, setGroup] = useState<GroupData | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [addedGameIds, setAddedGameIds] = useState<Set<number>>(new Set());
  const [selectedUsername, setSelectedUsername] = useState(initialUsername);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [addingGame, setAddingGame] = useState<number | null>(null);
  const [error, setError] = useState("");
  const toast = useToast();

  // Pagination & sort
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("added");
  const [sortDir, setSortDir] = useState<"" | "asc" | "desc">("");
  const [search, setSearch] = useState("");
  const searchDebounced = useDebouncedValue(search, 350);

  // Búsqueda en todo BGG (fuera de la colección). null = aún no buscada.
  const [globalResults, setGlobalResults] = useState<GlobalResult[] | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  // Última query ya buscada en global, para no repetir ni reintentar en bucle.
  const globalSearchedRef = useRef<string>("");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [maxRank, setMaxRank] = useState("");
  const [minPlays, setMinPlays] = useState("");
  const [unplayed, setUnplayed] = useState(false);

  // Búsqueda nueva (ya con la pausa): vuelta a la primera página y fuera los
  // resultados globales de la búsqueda anterior.
  const [lastSearch, setLastSearch] = useState(searchDebounced);
  if (lastSearch !== searchDebounced) {
    setLastSearch(searchDebounced);
    setPage(1);
    setGlobalResults(null);
  }

  // Fetch group data and already added games
  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const [groupRes, gamesRes] = await Promise.all([
          fetch(`/api/groups/${groupId}`, { credentials: "include" }),
          fetch(`/api/groups/${groupId}/games`, { credentials: "include" }),
        ]);

        if (groupRes.ok) {
          const data = await groupRes.json();
          setGroup(data);

          // Only set username from group data if we don't already have one from URL param
          if (!initialUsername) {
            const membersWithBgg = data.members.filter(
              (m: Member) => m.user.bggUsername
            );
            if (membersWithBgg.length > 0) {
              setSelectedUsername(membersWithBgg[0].user.bggUsername!);
            }
          }
        }

        if (gamesRes.ok) {
          const games = await gamesRes.json();
          const ids = new Set<number>(
            games.map((g: { game: { bggId: number } }) => g.game.bggId)
          );
          setAddedGameIds(ids);
        }
      } catch {
        setError("Error al cargar datos del grupo");
      } finally {
        setLoadingGroup(false);
      }
    };
    fetchGroup();
  }, [groupId, initialUsername]);

  // Fetch collection (paginated)
  // La página de colección que toca según usuario, orden, filtros y página.
  const collectionUrl = useMemo(() => {
    if (!selectedUsername) return null;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort,
    });
    if (sortDir) params.set("order", sortDir);
    if (searchDebounced) params.set("search", searchDebounced);
    if (minPlayers) params.set("minPlayers", minPlayers);
    if (maxPlayers) params.set("maxPlayers", maxPlayers);
    if (minWeight) params.set("minWeight", minWeight);
    if (maxWeight) params.set("maxWeight", maxWeight);
    if (maxRank) params.set("maxRank", maxRank);
    if (unplayed) params.set("unplayed", "true");
    else if (minPlays) params.set("minPlays", minPlays);
    return `/api/bgg/collection/${encodeURIComponent(selectedUsername)}?${params}`;
  }, [selectedUsername, page, sort, sortDir, searchDebounced, minPlayers, maxPlayers, minWeight, maxWeight, maxRank, minPlays, unplayed]);

  // Está cargando mientras la página que toca no ha respondido todavía, o
  // mientras se refresca a mano desde BGG. Las respuestas de una página que
  // ya no toca (cambiaste de filtro a medias) se descartan.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingCollection = refreshing || (collectionUrl !== null && collectionUrl !== loadedUrl);
  const wantedUrl = useRef<string | null>(null);

  const loadCollection = useCallback(
    (url: string, refresh = false) =>
      fetch(refresh ? `${url}&refresh=true` : url, { credentials: "include" })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error al cargar colección");
          return data as PaginatedResponse;
        })
        .then((data) => {
          if (url !== wantedUrl.current) return;
          setItems(data.items);
          setTotal(data.total);
          setTotalPages(data.totalPages);
          setError("");
        })
        .catch((err: unknown) => {
          if (url !== wantedUrl.current) return;
          setError(err instanceof Error ? err.message : "Error inesperado");
        })
        .finally(() => {
          if (url === wantedUrl.current) setLoadedUrl(url);
        }),
    []
  );

  // Re-fetch when params change
  useEffect(() => {
    wantedUrl.current = collectionUrl;
    if (collectionUrl) loadCollection(collectionUrl);
  }, [collectionUrl, loadCollection]);

  const refreshCollection = () => {
    if (!collectionUrl) return;
    setRefreshing(true);
    loadCollection(collectionUrl, true).finally(() => setRefreshing(false));
  };

  // Lanza una búsqueda en todo BGG (endpoint que anota qué miembros lo tienen).
  const searchAllBgg = useCallback(async () => {
    if (searchDebounced.trim().length < 2) return;
    globalSearchedRef.current = searchDebounced;
    setGlobalLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/groups/${groupId}/games/search?q=${encodeURIComponent(searchDebounced)}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al buscar en BGG");
      }
      const data: GlobalResult[] = await res.json();
      setGlobalResults(data);

      // Fase 2: pedir las imágenes que falten y rellenarlas al llegar.
      const missing = data
        .filter((g) => !g.thumbnail)
        .map((g) => g.bggId)
        .slice(0, 20);
      if (missing.length > 0) {
        fetch(`/api/bgg/thumbnails?ids=${missing.join(",")}`, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : {}))
          .then((thumbs: Record<number, string>) => {
            setGlobalResults((prev) =>
              prev
                ? prev.map((g) =>
                    thumbs[g.bggId] ? { ...g, thumbnail: thumbs[g.bggId] } : g
                  )
                : prev
            );
          })
          .catch(() => {
            /* ignore */
          });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setGlobalLoading(false);
    }
  }, [groupId, searchDebounced]);

  // Typeahead: si la colección no tiene resultados para lo que escribes,
  // lanzamos la búsqueda en todo BGG automáticamente (con ≥3 caracteres).
  // El ref evita repetir la misma query o reintentar en bucle ante un error.
  useEffect(() => {
    if (
      searchDebounced.trim().length >= 3 &&
      !loadingCollection &&
      !globalLoading &&
      globalResults === null &&
      globalSearchedRef.current !== searchDebounced &&
      items.filter((g) => !addedGameIds.has(g.bggId)).length === 0
    ) {
      searchAllBgg();
    }
  }, [searchDebounced, loadingCollection, globalLoading, globalResults, items, addedGameIds, searchAllBgg]);

  const handleAdd = async (bggId: number) => {
    setAddingGame(bggId);
    try {
      const res = await fetch(`/api/groups/${groupId}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bggId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al añadir juego");
      }

      // No lo quitamos de la lista: se queda visible marcado como añadido
      // (así la paginación no "salta" elementos y se ve que ya está).
      setAddedGameIds((prev) => new Set(prev).add(bggId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setAddingGame(null);
    }
  };

  const handleSort = (newSort: string) => {
    if (newSort === sort) {
      // Toggle direction: "" (default) → opposite → "" (default)
      const def = DEFAULT_SORT_DIR[sort] ?? "asc";
      const opposite = def === "asc" ? "desc" : "asc";
      setSortDir(sortDir === "" ? opposite : "");
    } else {
      setSort(newSort);
      setSortDir("");
    }
    setPage(1);
  };

  const applyFilters = () => {
    setPage(1);
  };

  const clearFilters = () => {
    setMinPlayers("");
    setMaxPlayers("");
    setMinWeight("");
    setMaxWeight("");
    setMaxRank("");
    setMinPlays("");
    setUnplayed(false);
    setPage(1);
  };

  const hasActiveFilters =
    minPlayers || maxPlayers || minWeight || maxWeight || maxRank || minPlays || unplayed;

  const membersWithBgg =
    group?.members.filter((m) => m.user.bggUsername) || [];

  // De quién es la colección que se está mirando, para los tooltips.
  const selectedMember = membersWithBgg.find((m) => m.user.bggUsername === selectedUsername);
  const selectedName = selectedMember
    ? displayName(selectedMember.user, selectedUsername)
    : selectedUsername;

  // Cuántos de los juegos visibles ya están en el ranking (para el contador).
  const addedCount = items.filter((g) => addedGameIds.has(g.bggId)).length;

  return (
    <PageShell nav={<Navbar />} width="main">
      <PageHeader title="Añadir juegos" back={{ href: `/groups/${groupId}`, label: "Volver al grupo" }} />

      {loadingGroup ? (
        <InlineLoading className="py-12" />
      ) : (
        <>
          {/* Username selector */}
          <div className={cardClass({ className: "mb-4" })}>
            <label htmlFor="bgg-collection" className={LABEL_CLASS}>
              Colección de BGG
            </label>
            {membersWithBgg.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Ningún miembro tiene un nombre de usuario de BGG configurado.
                Configúralo en tu{" "}
                <Link href="/profile" prefetch={false} className="text-[var(--primary)] underline">
                  perfil
                </Link>
                .
              </p>
            ) : (
              <div className="flex gap-2">
                <Select
                  id="bgg-collection"
                  value={selectedUsername}
                  onChange={(e) => {
                    setSelectedUsername(e.target.value);
                    setPage(1);
                  }}
                  className="flex-1"
                >
                  {membersWithBgg.map((m) => (
                    <option key={m.user.id} value={m.user.bggUsername!}>
                      {displayName(m.user)} ({m.user.bggUsername})
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={refreshCollection}
                  disabled={loadingCollection}
                  title="Actualizar colección desde BGG"
                  aria-label="Actualizar colección desde BGG"
                >
                  {loadingCollection ? <Spinner size="xs" tone="current" /> : <span aria-hidden>↻</span>}
                </Button>
              </div>
            )}
          </div>

          {/* Search + Sort toolbar */}
          <div className={cardClass({ className: "mb-4" })}>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
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

              {/* Sort buttons */}
              <div className="flex gap-1 flex-wrap">
                {SORT_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    size="sm"
                    active={sort === opt.value}
                    onClick={() => handleSort(opt.value)}
                    title={`Ordenar por ${opt.label.toLowerCase()}`}
                    className="gap-0! sm:px-3 sm:py-2"
                  >
                    <span className="sm:mr-1" aria-hidden>{opt.icon}</span>
                    <span className="sr-only sm:not-sr-only">{opt.label}</span>
                    {sort === opt.value && (
                      <span className="ml-1 opacity-70">
                        {(sortDir || DEFAULT_SORT_DIR[sort] || "asc") === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Antiludoteca toggle + Filter toggle */}
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                aria-pressed={unplayed}
                onClick={() => {
                  setUnplayed(!unplayed);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  unplayed
                    ? "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/50"
                    : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)] hover:text-[var(--text)]"
                }`}
              >
                📦 Antiludoteca
              </button>

              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
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
                Filtros avanzados
                {hasActiveFilters && (
                  <span className="bg-[var(--accent-soft)] text-[var(--primary)] text-xs px-2 py-0.5 rounded-full">
                    Activos
                  </span>
                )}
              </button>
            </div>

            {/* Collapsible filters */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <FilterSelect label="Jugadores (mín)" value={minPlayers} onChange={setMinPlayers}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}+
                      </option>
                    ))}
                  </FilterSelect>
                  <FilterSelect label="Jugadores (máx)" value={maxPlayers} onChange={setMaxPlayers}>
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        Hasta {n}
                      </option>
                    ))}
                  </FilterSelect>
                  <FilterSelect label="Peso mínimo" value={minWeight} onChange={setMinWeight}>
                    <option value="1">1+ (Ligero)</option>
                    <option value="2">2+ (Medio-ligero)</option>
                    <option value="3">3+ (Medio)</option>
                    <option value="4">4+ (Pesado)</option>
                  </FilterSelect>
                  <FilterSelect label="Peso máximo" value={maxWeight} onChange={setMaxWeight}>
                    <option value="2">Hasta 2 (Ligero)</option>
                    <option value="3">Hasta 3 (Medio)</option>
                    <option value="4">Hasta 4 (Pesado)</option>
                    <option value="5">Hasta 5 (Muy pesado)</option>
                  </FilterSelect>
                  <FilterSelect label="Rank máximo" value={maxRank} onChange={setMaxRank}>
                    <option value="100">Top 100</option>
                    <option value="250">Top 250</option>
                    <option value="500">Top 500</option>
                    <option value="1000">Top 1000</option>
                    <option value="2000">Top 2000</option>
                  </FilterSelect>
                  <FilterSelect label="Mín. partidas" value={minPlays} onChange={setMinPlays}>
                    <option value="1">1+ partida</option>
                    <option value="3">3+ partidas</option>
                    <option value="5">5+ partidas</option>
                    <option value="10">10+ partidas</option>
                    <option value="25">25+ partidas</option>
                  </FilterSelect>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={applyFilters}>
                    Aplicar
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && <Alert className="mb-4">{error}</Alert>}

          {/* Results header */}
          {!loadingCollection && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {plural(total, "juego", "juegos")}
                {addedCount > 0 && (
                  <span className="text-[var(--text-muted)]">
                    {" "}
                    ({addedCount} en el ranking)
                  </span>
                )}
                {searchDebounced && (
                  <span>
                    {" "}
                    para &ldquo;{searchDebounced}&rdquo;
                  </span>
                )}
              </p>
              {totalPages > 1 && (
                <p className="text-sm text-[var(--text-muted)]">
                  Página {page} de {totalPages}
                </p>
              )}
            </div>
          )}

          {/* Collection */}
          {loadingCollection ? (
            <InlineLoading className="py-12" />
          ) : items.length === 0 ? (
            <EmptyState
              title="No se encontraron juegos"
              description={searchDebounced || hasActiveFilters ? "Prueba a cambiar los filtros o la búsqueda" : undefined}
            />
          ) : (
            <>
              <div className="space-y-2">
                {items.map((game) => {
                  const isAdding = addingGame === game.bggId;
                  const isAdded = addedGameIds.has(game.bggId);

                  // Ya en el ranking: card slim y degradada, sin botón.
                  if (isAdded) {
                    return <AddedRow key={game.bggId} game={game} />;
                  }

                  return (
                    <div key={game.bggId} className={cardClass({ padding: "none", interactive: true, className: "overflow-hidden" })}>
                      <div className="p-3 flex items-center gap-3">
                        <GameThumb src={game.thumbnail} name={game.name} size="md" />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <GameTitle bggId={game.bggId} name={game.name} year={game.yearPublished} />
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {game.bggRating && (
                              <BggRating rating={game.bggRating} size={28} />
                            )}
                            <GameTags
                              game={{
                                bggRank: game.bggRank,
                                minPlayers: game.minPlayers,
                                maxPlayers: game.maxPlayers,
                                weight: game.weight,
                                numPlays: game.numPlays,
                                userRating: game.userRating,
                              }}
                              owner={selectedName}
                            />
                          </div>
                        </div>

                        <Button onClick={() => handleAdd(game.bggId)} loading={isAdding} className="shrink-0">
                          Añadir
                        </Button>
                      </div>

                      {/* Expansions sub-elements */}
                      {game.expansions.length > 0 && (
                        <div className="px-3 pb-2 pt-0 ml-17">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[11px] text-[var(--text-muted)] font-medium">
                              Expansiones:
                            </span>
                            {game.expansions.slice(0, 5).map((exp) => (
                              <a
                                key={exp.bggId}
                                href={bggGameUrl(exp.bggId, { expansion: true })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] bg-[var(--surface-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full hover:text-[var(--primary)] transition-colors"
                                title={exp.name}
                              >
                                {exp.thumbnail && (
                                  <Image
                                    src={exp.thumbnail}
                                    alt=""
                                    width={14}
                                    height={14}
                                    className="w-3.5 h-3.5 rounded-sm object-cover"
                                  />
                                )}
                                <span className="max-w-[80px] sm:max-w-[150px] truncate">
                                  {exp.name.replace(game.name, "").replace(/^[\s:–\-]+/, "").trim() || exp.name}
                                </span>
                              </a>
                            ))}
                            {game.expansions.length > 5 && (
                              <span className="text-[11px] text-[var(--text-muted)]">
                                +{game.expansions.length - 5} más
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav aria-label="Páginas" className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    aria-label="Primera página"
                  >
                    «
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ‹ Anterior
                  </Button>

                  {/* Page numbers */}
                  <div className="hidden sm:flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <Chip
                          key={pageNum}
                          active={page === pageNum}
                          onClick={() => setPage(pageNum)}
                          aria-current={page === pageNum ? "page" : undefined}
                          className="w-9 h-9 justify-center px-0! py-0!"
                        >
                          {pageNum}
                        </Chip>
                      );
                    })}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente ›
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    aria-label="Última página"
                  >
                    »
                  </Button>
                </nav>
              )}
            </>
          )}

          {/* ── Buscar en todo BGG (fuera de la colección) ── */}
          {searchDebounced.trim().length >= 2 && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              {globalLoading ? (
                <InlineLoading text="Buscando en todo BGG…" className="py-4" />
              ) : globalResults === null ? (
                <div className="text-center">
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    ¿No encuentras{" "}
                    <span className="font-medium text-[var(--text)]">
                      &ldquo;{searchDebounced}&rdquo;
                    </span>{" "}
                    en la colección?
                  </p>
                  <Button variant="soft" size="lg" onClick={searchAllBgg}>
                    🔎 Buscar en todo BGG
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Resultados en todo BGG
                    </h2>
                    <Button variant="ghost" size="xs" onClick={() => setGlobalResults(null)}>
                      ✕ Cerrar
                    </Button>
                  </div>
                  {globalResults.length === 0 ? (
                    <EmptyState title="No hay resultados en BGG para esta búsqueda." className="py-6" />
                  ) : (
                    <div className="space-y-2">
                      {globalResults.map((game) => {
                        const isAdding = addingGame === game.bggId;
                        const isAdded = addedGameIds.has(game.bggId);
                        const nobodyHasIt = game.owners.length === 0;

                        // Ya en el ranking: card slim y degradada.
                        if (isAdded) {
                          return <AddedRow key={game.bggId} game={game} />;
                        }

                        return (
                          <div key={game.bggId} className={cardClass({ padding: "sm", className: "flex items-center gap-3" })}>
                            <GameThumb src={game.thumbnail} name={game.name} size="md" />
                            <div className="flex-1 min-w-0">
                              <GameTitle bggId={game.bggId} name={game.name} year={game.yearPublished} />
                              <div className="mt-1.5">
                                {nobodyHasIt ? (
                                  <GameTag tone="amber">⚠️ Nadie del grupo lo tiene</GameTag>
                                ) : (
                                  <GameTag tone="green" title={game.owners.join(", ")}>
                                    ✓{" "}
                                    {game.owners.length === 1
                                      ? `En la colección de ${game.owners[0]}`
                                      : `Lo tienen ${game.owners.length} miembros`}
                                  </GameTag>
                                )}
                              </div>
                            </div>
                            <Button onClick={() => handleAdd(game.bggId)} loading={isAdding} className="shrink-0">
                              Añadir
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

/** Un filtro avanzado: etiqueta y desplegable con «Cualquiera» de primeras. */
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <Select id={id} size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Cualquiera</option>
          {children}
        </Select>
      )}
    </Field>
  );
}

/** Nombre del juego con enlace a BGG y su año. */
function GameTitle({ bggId, name, year }: { bggId: number; name: string; year: number | null }) {
  return (
    <div className="font-medium text-[var(--text)] text-sm truncate">
      <a
        href={bggGameUrl(bggId)}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-[var(--primary)] transition-colors"
        title="Ver en BGG"
      >
        {name}
        <span className="inline-block ml-1 text-[var(--text-muted)] text-xs align-middle" aria-hidden>↗</span>
      </a>
      {year && <span className="text-[var(--text-muted)] font-normal ml-1">({year})</span>}
    </div>
  );
}

/** Un juego que ya está en el ranking: fila estrecha y apagada, sin botón. */
function AddedRow({
  game,
}: {
  game: { name: string; thumbnail?: string | null; yearPublished: number | null };
}) {
  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] opacity-60 flex items-center gap-3 p-2">
      <GameThumb src={game.thumbnail} name={game.name} size="sm" />
      <div className="flex-1 min-w-0 text-sm text-[var(--text-secondary)] truncate">
        {game.name}
        {game.yearPublished && <span className="text-[var(--text-muted)] ml-1">({game.yearPublished})</span>}
      </div>
      <span className="text-xs text-[var(--text-muted)] shrink-0">✓ En el ranking</span>
    </div>
  );
}
