"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";

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
}

interface PaginatedResponse {
  items: CollectionItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Member {
  role: string;
  user: {
    id: string;
    name: string | null;
    surname: string | null;
    email: string;
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

export default function AddGamesPage() {
  const { id: groupId } = useParams<{ id: string }>();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [addedGameIds, setAddedGameIds] = useState<Set<number>>(new Set());
  const [selectedUsername, setSelectedUsername] = useState("");
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [addingGame, setAddingGame] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Pagination & sort
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("added");
  const [sortDir, setSortDir] = useState<"" | "asc" | "desc">("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [maxRank, setMaxRank] = useState("");
  const [minPlays, setMinPlays] = useState("");
  const [unplayed, setUnplayed] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

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

          const membersWithBgg = data.members.filter(
            (m: Member) => m.user.bggUsername
          );
          if (membersWithBgg.length > 0) {
            setSelectedUsername(membersWithBgg[0].user.bggUsername!);
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
  }, [groupId]);

  // Fetch collection (paginated)
  const loadCollection = useCallback(
    async (refresh = false) => {
      if (!selectedUsername) return;
      setLoadingCollection(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sort,
        });
        if (sortDir) params.set("order", sortDir);
        if (refresh) params.set("refresh", "true");
        if (searchDebounced) params.set("search", searchDebounced);
        if (minPlayers) params.set("minPlayers", minPlayers);
        if (maxPlayers) params.set("maxPlayers", maxPlayers);
        if (minWeight) params.set("minWeight", minWeight);
        if (maxWeight) params.set("maxWeight", maxWeight);
        if (maxRank) params.set("maxRank", maxRank);
        if (unplayed) params.set("unplayed", "true");
        else if (minPlays) params.set("minPlays", minPlays);

        const url = `/api/bgg/collection/${encodeURIComponent(selectedUsername)}?${params}`;
        const res = await fetch(url, { credentials: "include" });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al cargar colección");
        }

        const data: PaginatedResponse = await res.json();
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setLoadingCollection(false);
      }
    },
    [selectedUsername, page, sort, sortDir, searchDebounced, minPlayers, maxPlayers, minWeight, maxWeight, maxRank, minPlays, unplayed]
  );

  // Re-fetch when params change
  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

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

      setAddedGameIds((prev) => new Set(prev).add(bggId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setAddingGame(null);
    }
  };

  const handleSort = (newSort: string) => {
    if (newSort === sort) {
      // Toggle direction: "" (default) → opposite → "" (default)
      const defaults: Record<string, "asc" | "desc"> = {
        added: "desc", rank: "asc", rating: "desc", weight: "asc",
        name: "asc", plays: "desc", year: "desc",
      };
      const def = defaults[sort] ?? "asc";
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

  const weightLabel = (w: number) => {
    if (w < 1.5) return "Ligero";
    if (w < 2.5) return "Medio-ligero";
    if (w < 3.5) return "Medio";
    if (w < 4.5) return "Pesado";
    return "Muy pesado";
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-900 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link
              href={`/groups/${groupId}`}
              prefetch={false}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              &larr; Volver al grupo
            </Link>
            <h1 className="text-2xl font-bold text-slate-100">
              Añadir juegos
            </h1>
          </div>

          {loadingGroup ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
            </div>
          ) : (
            <>
              {/* Username selector */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Colección de BGG
                </label>
                {membersWithBgg.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Ningún miembro tiene un nombre de usuario de BGG configurado.
                    Configúralo en tu{" "}
                    <Link href="/profile" prefetch={false} className="text-amber-400 underline">
                      perfil
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={selectedUsername}
                      onChange={(e) => {
                        setSelectedUsername(e.target.value);
                        setPage(1);
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    >
                      {membersWithBgg.map((m) => (
                        <option key={m.user.id} value={m.user.bggUsername!}>
                          {m.user.name || m.user.email} ({m.user.bggUsername})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => loadCollection(true)}
                      disabled={loadingCollection}
                      title="Actualizar colección desde BGG"
                      className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-400 hover:text-amber-400 hover:border-amber-500/50 disabled:opacity-50 transition-colors"
                    >
                      {loadingCollection ? (
                        <span className="animate-spin inline-block">↻</span>
                      ) : (
                        "↻"
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Search + Sort toolbar */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
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
                      className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Sort buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSort(opt.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          sort === opt.value
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                            : "bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-200 hover:border-slate-500"
                        }`}
                      >
                        <span className="mr-1">{opt.icon}</span>
                        {opt.label}
                        {sort === opt.value && (
                          <span className="ml-1 opacity-70">
                            {(() => {
                              const defaults: Record<string, string> = {
                                added: "desc", rank: "asc", rating: "desc", weight: "asc",
                                name: "asc", plays: "desc", year: "desc",
                              };
                              const effective = sortDir || defaults[sort] || "asc";
                              return effective === "asc" ? "↑" : "↓";
                            })()}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Antiludoteca toggle + Filter toggle */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => {
                      setUnplayed(!unplayed);
                      setPage(1);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      unplayed
                        ? "bg-red-500/20 text-red-300 border border-red-500/50"
                        : "bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    📦 Antiludoteca
                  </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="mt-3 flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  Filtros avanzados
                  {hasActiveFilters && (
                    <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                      Activos
                    </span>
                  )}
                </button>
                </div>

                {/* Collapsible filters */}
                {showFilters && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                          Jugadores (mín)
                        </label>
                        <select
                          value={minPlayers}
                          onChange={(e) => setMinPlayers(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Cualquiera</option>
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {n}+
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                          Jugadores (máx)
                        </label>
                        <select
                          value={maxPlayers}
                          onChange={(e) => setMaxPlayers(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Cualquiera</option>
                          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                            <option key={n} value={n}>
                              Hasta {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                          Peso mínimo
                        </label>
                        <select
                          value={minWeight}
                          onChange={(e) => setMinWeight(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Cualquiera</option>
                          <option value="1">1+ (Ligero)</option>
                          <option value="2">2+ (Medio-ligero)</option>
                          <option value="3">3+ (Medio)</option>
                          <option value="4">4+ (Pesado)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                          Peso máximo
                        </label>
                        <select
                          value={maxWeight}
                          onChange={(e) => setMaxWeight(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Cualquiera</option>
                          <option value="2">Hasta 2 (Ligero)</option>
                          <option value="3">Hasta 3 (Medio)</option>
                          <option value="4">Hasta 4 (Pesado)</option>
                          <option value="5">Hasta 5 (Muy pesado)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                          Rank máximo
                        </label>
                        <select
                          value={maxRank}
                          onChange={(e) => setMaxRank(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Cualquiera</option>
                          <option value="100">Top 100</option>
                          <option value="250">Top 250</option>
                          <option value="500">Top 500</option>
                          <option value="1000">Top 1000</option>
                          <option value="2000">Top 2000</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                          Mín. partidas
                        </label>
                        <select
                          value={minPlays}
                          onChange={(e) => setMinPlays(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Cualquiera</option>
                          <option value="1">1+ partida</option>
                          <option value="3">3+ partidas</option>
                          <option value="5">5+ partidas</option>
                          <option value="10">10+ partidas</option>
                          <option value="25">25+ partidas</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={applyFilters}
                        className="px-4 py-1.5 bg-amber-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                      >
                        Aplicar
                      </button>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="px-4 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Results header */}
              {!loadingCollection && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-400">
                    {total} juego{total !== 1 && "s"}
                    {searchDebounced && (
                      <span>
                        {" "}
                        para &ldquo;{searchDebounced}&rdquo;
                      </span>
                    )}
                  </p>
                  {totalPages > 1 && (
                    <p className="text-sm text-slate-500">
                      Página {page} de {totalPages}
                    </p>
                  )}
                </div>
              )}

              {/* Collection */}
              {loadingCollection ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-lg">
                    No se encontraron juegos
                  </p>
                  {(searchDebounced || hasActiveFilters) && (
                    <p className="text-slate-600 text-sm mt-1">
                      Prueba a cambiar los filtros o la búsqueda
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {items.map((game) => {
                      const isAdded = addedGameIds.has(game.bggId);
                      const isAdding = addingGame === game.bggId;

                      return (
                        <div
                          key={game.bggId}
                          className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex items-center gap-3 hover:border-slate-600 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-slate-700">
                            {game.thumbnail ? (
                              <img
                                src={game.thumbnail}
                                alt={game.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                                ?
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-100 text-sm truncate">
                              <a
                                href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-amber-300 transition-colors"
                                title="Ver en BGG"
                              >
                                {game.name}
                                <span className="inline-block ml-1 text-slate-500 text-xs align-middle">↗</span>
                              </a>
                              {game.yearPublished && (
                                <span className="text-slate-500 font-normal ml-1">
                                  ({game.yearPublished})
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {game.bggRank && (
                                <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full">
                                  #{game.bggRank}
                                </span>
                              )}
                              {game.bggRating && (
                                <span className="inline-flex items-center gap-1 text-xs bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full">
                                  ★ {game.bggRating.toFixed(1)}
                                </span>
                              )}
                              {(game.minPlayers || game.maxPlayers) && (
                                <span className="inline-flex items-center gap-1 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                                  👥 {game.minPlayers}-{game.maxPlayers}
                                </span>
                              )}
                              {game.weight && (
                                <span className="inline-flex items-center gap-1 text-xs bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full" title={weightLabel(game.weight)}>
                                  ⚖️ {game.weight.toFixed(1)}
                                </span>
                              )}
                              {game.numPlays > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs bg-green-500/15 text-green-300 px-2 py-0.5 rounded-full">
                                  🎲 {game.numPlays} partida{game.numPlays !== 1 && "s"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs bg-red-500/15 text-red-300 px-2 py-0.5 rounded-full">
                                  📦 Sin estrenar
                                </span>
                              )}
                              {game.userRating && (
                                <span className="inline-flex items-center gap-1 text-xs bg-pink-500/15 text-pink-300 px-2 py-0.5 rounded-full">
                                  ♥ {game.userRating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Add button */}
                          <button
                            onClick={() => handleAdd(game.bggId)}
                            disabled={isAdded || isAdding}
                            className={`px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${
                              isAdded
                                ? "bg-green-500/20 text-green-400 cursor-default"
                                : "bg-amber-500 text-slate-900 hover:bg-amber-600 disabled:opacity-50"
                            }`}
                          >
                            {isAdded ? "✓ Añadido" : isAdding ? "..." : "Añadir"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        «
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        ‹ Anterior
                      </button>

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
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                page === pageNum
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                                  : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        Siguiente ›
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        »
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
