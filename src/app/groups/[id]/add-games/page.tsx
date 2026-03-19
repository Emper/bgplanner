"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
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

export default function AddGamesPage() {
  const { id: groupId } = useParams<{ id: string }>();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [addedGameIds, setAddedGameIds] = useState<Set<number>>(new Set());
  const [selectedUsername, setSelectedUsername] = useState("");
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [addingGame, setAddingGame] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Filters
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [maxRank, setMaxRank] = useState("");
  const [minPlays, setMinPlays] = useState("");

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

          // Auto-select first member with bggUsername
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

  // Fetch collection when username changes
  const loadCollection = async (refresh = false) => {
    if (!selectedUsername) return;
    setLoadingCollection(true);
    setError("");
    if (!refresh) setCollection([]);

    try {
      const url = `/api/bgg/collection/${encodeURIComponent(selectedUsername)}${refresh ? "?refresh=true" : ""}`;
      const res = await fetch(url, { credentials: "include" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al cargar colección");
      }

      const data = await res.json();
      setCollection(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoadingCollection(false);
    }
  };

  useEffect(() => {
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUsername]);

  const filtered = useMemo(() => {
    return collection.filter((game) => {
      if (minPlayers && game.maxPlayers && game.maxPlayers < Number(minPlayers))
        return false;
      if (maxPlayers && game.minPlayers && game.minPlayers > Number(maxPlayers))
        return false;
      if (minWeight && game.weight && game.weight < Number(minWeight))
        return false;
      if (maxWeight && game.weight && game.weight > Number(maxWeight))
        return false;
      if (maxRank && game.bggRank && game.bggRank > Number(maxRank))
        return false;
      if (minPlays && game.numPlays < Number(minPlays)) return false;
      return true;
    });
  }, [collection, minPlayers, maxPlayers, minWeight, maxWeight, maxRank, minPlays]);

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

  const membersWithBgg = group?.members.filter((m) => m.user.bggUsername) || [];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-900 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link
              href={`/groups/${groupId}`}
              className="text-sm text-amber-400 hover:text-amber-400"
            >
              &larr; Volver al grupo
            </Link>
            <h1 className="text-2xl font-bold text-slate-100">
              Añadir juegos
            </h1>
          </div>

          {loadingGroup ? (
            <p className="text-slate-500">Cargando...</p>
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
                    <Link href="/profile" className="text-amber-400 underline">
                      perfil
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={selectedUsername}
                      onChange={(e) => setSelectedUsername(e.target.value)}
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
                      {loadingCollection ? "..." : "↻"}
                    </button>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
                <h3 className="text-sm font-medium text-slate-200 mb-3">
                  Filtros
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Min jugadores
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minPlayers}
                      onChange={(e) => setMinPlayers(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Max jugadores
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Peso min
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={minWeight}
                      onChange={(e) => setMinWeight(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Peso max
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={maxWeight}
                      onChange={(e) => setMaxWeight(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Rank max
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxRank}
                      onChange={(e) => setMaxRank(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Min partidas
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minPlays}
                      onChange={(e) => setMinPlays(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

              {/* Collection */}
              {loadingCollection ? (
                <p className="text-slate-500">Cargando colección...</p>
              ) : (
                <>
                  <p className="text-sm text-slate-400 mb-3">
                    {filtered.length} juegos
                    {filtered.length !== collection.length &&
                      ` (de ${collection.length} en colección)`}
                  </p>

                  <div className="space-y-2">
                    {filtered.map((game) => {
                      const isAdded = addedGameIds.has(game.bggId);
                      const isAdding = addingGame === game.bggId;

                      return (
                        <div
                          key={game.bggId}
                          className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex items-center gap-3"
                        >
                          {/* Thumbnail */}
                          <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-slate-700">
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
                              {game.name}
                              {game.yearPublished && (
                                <span className="text-slate-500 font-normal ml-1">
                                  ({game.yearPublished})
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {(game.minPlayers || game.maxPlayers) && (
                                <span className="text-xs text-slate-400">
                                  {game.minPlayers}-{game.maxPlayers} jug.
                                </span>
                              )}
                              {game.bggRating && (
                                <span className="text-xs text-blue-400">
                                  ★ {game.bggRating.toFixed(1)}
                                </span>
                              )}
                              {game.weight && (
                                <span className="text-xs text-purple-400">
                                  Peso: {game.weight.toFixed(1)}
                                </span>
                              )}
                              {game.bggRank && (
                                <span className="text-xs text-slate-500">
                                  #{game.bggRank}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Add button */}
                          <button
                            onClick={() => handleAdd(game.bggId)}
                            disabled={isAdded || isAdding}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 ${
                              isAdded
                                ? "bg-green-500/20 text-green-400 cursor-default"
                                : "bg-amber-500 text-slate-900 hover:bg-amber-600 disabled:opacity-50"
                            }`}
                          >
                            {isAdded
                              ? "Añadido"
                              : isAdding
                                ? "..."
                                : "Añadir"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
