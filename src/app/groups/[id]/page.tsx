"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";

interface Game {
  id: string;
  bggId: number;
  name: string;
  thumbnail: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  bggRating: number | null;
  bggRank: number | null;
  weight: number | null;
}

interface RankedGame {
  groupGameId: string;
  game: Game;
  addedBy: { name: string | null };
  addedById: string;
  score: number;
  upVotes: number;
  superVotes: number;
  downVotes: number;
  userVote: "up" | "super" | "down" | null;
  playCount: number;
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

interface Invitation {
  email: string;
  createdAt: string;
}

interface GroupData {
  id: string;
  name: string;
  members: Member[];
  _count: { games: number };
  invitations: Invitation[];
  currentUserRole: string;
  currentUserId: string;
}

interface SuggestedGame {
  gameId: string;
  bggId: number;
  name: string;
  thumbnail: string | null;
  playingTime: number | null;
  weight: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  score: number;
}

interface SessionGame {
  id: string;
  order: number;
  status: string;
  game: {
    id: string;
    bggId: number;
    name: string;
    thumbnail: string | null;
    playingTime: number | null;
    minPlayers: number | null;
    maxPlayers: number | null;
    weight: number | null;
  };
}

interface GameSessionData {
  id: string;
  name: string | null;
  date: string;
  playerCount: number;
  totalMinutes: number;
  status: string;
  createdBy: { name: string | null };
  games: SessionGame[];
}

type Tab = "ranking" | "sessions" | "members";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function GroupDashboardPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [ranking, setRanking] = useState<RankedGame[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  // "Esta noche" filters
  const [tonightPlayers, setTonightPlayers] = useState("");
  const [tonightMaxWeight, setTonightMaxWeight] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("ranking");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingGame, setVotingGame] = useState<string | null>(null);
  const [removingGame, setRemovingGame] = useState<string | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<GameSessionData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [sessionPlayers, setSessionPlayers] = useState("4");
  const [sessionHours, setSessionHours] = useState("4");
  const [sessionName, setSessionName] = useState("");
  const [suggestedGames, setSuggestedGames] = useState<SuggestedGame[]>([]);
  const [allCandidates, setAllCandidates] = useState<SuggestedGame[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      // Single API call loads everything: group, ranking, sessions
      const res = await fetch(`/api/groups/${groupId}/dashboard`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Error al cargar el grupo");
      }

      const data = await res.json();

      setGroup(data.group);
      setRanking(data.ranking);
      setMemberCount(data.memberCount);
      setSessions(data.sessions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh sessions independently (after creating/editing a session)
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/sessions`, {
        credentials: "include",
      });
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoadingSessions(false);
    }
  }, [groupId]);

  // Filter ranking for "tonight" mode
  const filteredRanking = ranking.filter((item) => {
    if (tonightPlayers) {
      const n = parseInt(tonightPlayers);
      const min = item.game.minPlayers ?? 0;
      const max = item.game.maxPlayers ?? 99;
      if (n < min || n > max) return false;
    }
    if (tonightMaxWeight) {
      const maxW = parseFloat(tonightMaxWeight);
      if (item.game.weight && item.game.weight > maxW) return false;
    }
    return true;
  });

  // Split into pending (not yet played) and played
  const pendingGames = filteredRanking.filter((item) => item.playCount === 0);
  const playedGames = filteredRanking.filter((item) => item.playCount > 0);

  const tonightActive = !!(tonightPlayers || tonightMaxWeight);

  const canRemoveGame = (item: RankedGame) =>
    group?.currentUserRole === "admin" || item.addedById === group?.currentUserId;

  const handleVote = async (
    gameId: string,
    gameDbId: string,
    type: "up" | "super" | "down",
    currentVote: string | null
  ) => {
    setVotingGame(gameDbId);

    try {
      if (currentVote === type) {
        const res = await fetch(
          `/api/groups/${groupId}/games/${gameId}/vote`,
          { method: "DELETE", credentials: "include" }
        );
        if (!res.ok) throw new Error("Error al eliminar voto");
      } else {
        const res = await fetch(
          `/api/groups/${groupId}/games/${gameId}/vote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ type }),
          }
        );

        if (res.status === 409) {
          const data = await res.json();
          const move = confirm(
            "Ya tienes un super voto en otro juego de este grupo. ¿Quieres moverlo a este juego?"
          );
          if (move) {
            const oldGameId = data.existingSuperGameId;
            await fetch(
              `/api/groups/${groupId}/games/${oldGameId}/vote`,
              { method: "DELETE", credentials: "include" }
            );
            await fetch(
              `/api/groups/${groupId}/games/${gameId}/vote`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ type: "super" }),
              }
            );
          } else {
            setVotingGame(null);
            return;
          }
        } else if (!res.ok) {
          throw new Error("Error al votar");
        }
      }

      const rankingRes = await fetch(`/api/groups/${groupId}/ranking`, {
        credentials: "include",
      });
      if (rankingRes.ok) {
        const data = await rankingRes.json();
        setRanking(data.ranking);
      }
    } catch {
      alert("Error al procesar el voto");
    } finally {
      setVotingGame(null);
    }
  };

  const handleRemoveGame = async (gameId: string, gameName: string) => {
    if (!confirm(`¿Eliminar "${gameName}" del grupo? Se perderán todos los votos.`)) return;
    setRemovingGame(gameId);
    try {
      const res = await fetch(`/api/groups/${groupId}/games/${gameId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar");
      }
      setRanking((prev) => prev.filter((r) => r.game.id !== gameId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar juego");
    } finally {
      setRemovingGame(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteMsg("");
    setInviting(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar invitación");
      }

      setInviteMsg(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail("");
      const groupRes = await fetch(`/api/groups/${groupId}`, {
        credentials: "include",
      });
      if (groupRes.ok) {
        setGroup(await groupRes.json());
      }
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setInviting(false);
    }
  };

  // Session planning
  const handleSuggestGames = async () => {
    setLoadingSuggestion(true);
    try {
      const minutes = parseFloat(sessionHours) * 60;
      const res = await fetch(
        `/api/groups/${groupId}/sessions/suggest?players=${sessionPlayers}&minutes=${minutes}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Error al obtener sugerencias");
      const data = await res.json();
      setSuggestedGames(data.suggested);
      setAllCandidates(data.all);
      setSelectedGameIds(new Set(data.suggested.map((g: SuggestedGame) => g.gameId)));
    } catch {
      alert("Error al generar sugerencias");
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const toggleGameSelection = (gameId: string) => {
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const selectedTotalTime = allCandidates
    .filter((g) => selectedGameIds.has(g.gameId))
    .reduce((acc, g) => acc + (g.playingTime || 90), 0);

  const handleSaveSession = async () => {
    setSavingSession(true);
    try {
      const orderedIds = allCandidates
        .filter((g) => selectedGameIds.has(g.gameId))
        .sort((a, b) => b.score - a.score)
        .map((g) => g.gameId);

      const res = await fetch(`/api/groups/${groupId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: sessionName || null,
          date: sessionDate,
          playerCount: sessionPlayers,
          totalMinutes: parseFloat(sessionHours) * 60,
          gameIds: orderedIds,
        }),
      });

      if (!res.ok) throw new Error("Error al crear sesión");

      // Reset form and refresh
      setShowNewSession(false);
      setSessionName("");
      setSuggestedGames([]);
      setAllCandidates([]);
      setSelectedGameIds(new Set());
      await fetchSessions();
    } catch {
      alert("Error al guardar la sesión");
    } finally {
      setSavingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("¿Eliminar esta sesión?")) return;
    try {
      await fetch(`/api/groups/${groupId}/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      alert("Error al eliminar sesión");
    }
  };

  const handleUpdateSession = async (sessionId: string, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch {
      alert("Error al actualizar sesión");
    }
  };

  const handleGameStatus = async (sessionId: string, gameSessionGameId: string, newStatus: string) => {
    await handleUpdateSession(sessionId, {
      gameStatuses: { [gameSessionGameId]: newStatus },
    });
  };

  const handleRemoveGameFromSession = async (sessionId: string, gameIdToRemove: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const remainingIds = session.games
      .filter((g) => g.game.id !== gameIdToRemove)
      .map((g) => g.game.id);
    await handleUpdateSession(sessionId, { gameIds: remainingIds });
  };

  const handleAddGameToSession = async (sessionId: string) => {
    // Get suggestions for this session's parameters
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    try {
      const res = await fetch(
        `/api/groups/${groupId}/sessions/suggest?players=${session.playerCount}&minutes=${session.totalMinutes}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();
      // Filter out games already in session
      const existingIds = new Set(session.games.map((g) => g.game.id));
      const available = data.all.filter((g: SuggestedGame) => !existingIds.has(g.gameId));
      if (available.length === 0) {
        alert("No hay más juegos compatibles disponibles");
        return;
      }
      setAllCandidates(available);
      setSuggestedGames([]);
      setSelectedGameIds(new Set());
      setEditingSessionId(sessionId);
    } catch {
      alert("Error al cargar juegos disponibles");
    }
  };

  const handleConfirmAddGames = async () => {
    if (!editingSessionId) return;
    const session = sessions.find((s) => s.id === editingSessionId);
    if (!session) return;
    const existingIds = session.games.map((g) => g.game.id);
    const newIds = allCandidates
      .filter((g) => selectedGameIds.has(g.gameId))
      .map((g) => g.gameId);
    await handleUpdateSession(editingSessionId, {
      gameIds: [...existingIds, ...newIds],
    });
    setEditingSessionId(null);
    setAllCandidates([]);
    setSelectedGameIds(new Set());
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Cargando...
        </div>
      </>
    );
  }

  if (error || !group) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-red-400">{error || "Grupo no encontrado"}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-900 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-100">{group.name}</h1>
            <p className="text-sm text-slate-400">
              {group.members.length} miembros &middot; {group._count.games}{" "}
              juegos
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-slate-700">
            {(["ranking", "sessions", "members"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "ranking" ? "Ranking" : tab === "sessions" ? "Sesiones" : "Miembros"}
              </button>
            ))}
          </div>

          {/* ═══════════ Ranking Tab ═══════════ */}
          {activeTab === "ranking" && (
            <div>
              {/* Toolbar */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <span className="text-sm font-medium text-slate-300">🌙 Esta noche:</span>
                    <select
                      value={tonightPlayers}
                      onChange={(e) => setTonightPlayers(e.target.value)}
                      className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">Jugadores...</option>
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>Somos {n}</option>
                      ))}
                    </select>
                    <select
                      value={tonightMaxWeight}
                      onChange={(e) => setTonightMaxWeight(e.target.value)}
                      className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">Peso...</option>
                      <option value="2">Ligero (≤2)</option>
                      <option value="3">Medio (≤3)</option>
                      <option value="4">Pesado (≤4)</option>
                      <option value="5">Cualquier peso</option>
                    </select>
                    {tonightActive && (
                      <button
                        onClick={() => { setTonightPlayers(""); setTonightMaxWeight(""); }}
                        className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
                      >
                        ✕ Limpiar
                      </button>
                    )}
                  </div>
                  <Link
                    href={`/groups/${groupId}/add-games`}
                    prefetch={false}
                    className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 text-sm font-medium shrink-0"
                  >
                    Añadir juegos
                  </Link>
                </div>
                {tonightActive && (
                  <p className="text-xs text-slate-500 mt-2">
                    Mostrando {filteredRanking.length} de {ranking.length} juegos
                  </p>
                )}
              </div>

              {ranking.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center text-slate-400">
                  No hay juegos en este grupo todavía. ¡Añade algunos!
                </div>
              ) : filteredRanking.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center text-slate-400">
                  Ningún juego encaja con los filtros de esta noche.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ── Pending games (not yet played) ── */}
                  {pendingGames.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Pendientes de jugar ({pendingGames.length})
                      </h3>
                      <div className="space-y-3">
                        {pendingGames.map((item, index) => (
                          <div
                            key={item.groupGameId}
                            className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center gap-4"
                          >
                            <div className="text-lg font-bold text-slate-500 w-8 text-center shrink-0">
                              #{index + 1}
                            </div>
                            <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-700">
                              {item.game.thumbnail ? (
                                <img src={item.game.thumbnail} alt={item.game.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-100 truncate">
                                <a
                                  href={`https://boardgamegeek.com/boardgame/${item.game.bggId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-amber-300 transition-colors"
                                >
                                  {item.game.name}
                                  <span className="inline-block ml-1 text-slate-500 text-xs align-middle">↗</span>
                                </a>
                                {item.game.yearPublished && (
                                  <span className="text-slate-500 font-normal ml-1">({item.game.yearPublished})</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {item.game.bggRating && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                                    ★ {item.game.bggRating.toFixed(1)}
                                  </span>
                                )}
                                {item.game.playingTime && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                                    ⏱ {formatDuration(item.game.playingTime)}
                                  </span>
                                )}
                                {item.game.weight && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                                    ⚖️ {item.game.weight.toFixed(1)}
                                  </span>
                                )}
                                {(item.game.minPlayers || item.game.maxPlayers) && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                                    {item.game.minPlayers === item.game.maxPlayers
                                      ? `${item.game.minPlayers}p`
                                      : `${item.game.minPlayers || "?"}-${item.game.maxPlayers || "?"}p`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-center shrink-0">
                              <div className="text-xl font-bold text-slate-100">{item.score}</div>
                              <div className="text-xs text-slate-500">pts</div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {(["up", "super", "down"] as const).map((type) => (
                                <button
                                  key={type}
                                  onClick={() => handleVote(item.game.id, item.groupGameId, type, item.userVote)}
                                  disabled={votingGame === item.groupGameId}
                                  className={`w-9 h-9 flex items-center justify-center rounded-lg border text-lg transition-colors disabled:opacity-50 ${
                                    item.userVote === type
                                      ? type === "up"
                                        ? "bg-amber-500/20 border-amber-500 text-amber-400"
                                        : type === "super"
                                          ? "bg-orange-500/20 border-orange-500 text-orange-400"
                                          : "bg-red-500/20 border-red-500 text-red-400"
                                      : "border-slate-700 text-slate-500 hover:bg-slate-700"
                                  }`}
                                  title={type === "up" ? "+1" : type === "super" ? "+3 (Super)" : "-1"}
                                >
                                  {type === "up" ? "👍" : type === "super" ? "🔥" : "👎"}
                                </button>
                              ))}
                              {canRemoveGame(item) && (
                                <button
                                  onClick={() => handleRemoveGame(item.game.id, item.game.name)}
                                  disabled={removingGame === item.game.id}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-600 hover:text-red-400 hover:border-red-500/50 transition-colors disabled:opacity-50"
                                  title="Eliminar del grupo"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Already played games ── */}
                  {playedGames.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Ya jugados ({playedGames.length})
                      </h3>
                      <div className="space-y-2">
                        {playedGames.map((item) => (
                          <div
                            key={item.groupGameId}
                            className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-3 flex items-center gap-3"
                          >
                            <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-slate-700">
                              {item.game.thumbnail ? (
                                <img src={item.game.thumbnail} alt={item.game.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-300 text-sm truncate">
                                <a
                                  href={`https://boardgamegeek.com/boardgame/${item.game.bggId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-amber-300 transition-colors"
                                >
                                  {item.game.name}
                                  <span className="inline-block ml-1 text-slate-500 text-xs align-middle">↗</span>
                                </a>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400">
                                  {item.playCount} partida{item.playCount !== 1 && "s"}
                                </span>
                                {item.game.bggRating && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400/70">
                                    ★ {item.game.bggRating.toFixed(1)}
                                  </span>
                                )}
                                {item.game.playingTime && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-400">
                                    ⏱ {formatDuration(item.game.playingTime)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-center shrink-0">
                              <div className="text-lg font-bold text-slate-400">{item.score}</div>
                              <div className="text-xs text-slate-600">pts</div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {(["up", "super", "down"] as const).map((type) => (
                                <button
                                  key={type}
                                  onClick={() => handleVote(item.game.id, item.groupGameId, type, item.userVote)}
                                  disabled={votingGame === item.groupGameId}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg border text-base transition-colors disabled:opacity-50 ${
                                    item.userVote === type
                                      ? type === "up"
                                        ? "bg-amber-500/20 border-amber-500 text-amber-400"
                                        : type === "super"
                                          ? "bg-orange-500/20 border-orange-500 text-orange-400"
                                          : "bg-red-500/20 border-red-500 text-red-400"
                                      : "border-slate-700 text-slate-600 hover:bg-slate-700"
                                  }`}
                                  title={type === "up" ? "+1" : type === "super" ? "+3 (Super)" : "-1"}
                                >
                                  {type === "up" ? "👍" : type === "super" ? "🔥" : "👎"}
                                </button>
                              ))}
                              {canRemoveGame(item) && (
                                <button
                                  onClick={() => handleRemoveGame(item.game.id, item.game.name)}
                                  disabled={removingGame === item.game.id}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-600 hover:text-red-400 hover:border-red-500/50 transition-colors disabled:opacity-50"
                                  title="Eliminar del grupo"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ Sessions Tab ═══════════ */}
          {activeTab === "sessions" && (
            <div className="space-y-4">
              {/* New session button */}
              {!showNewSession && (
                <button
                  onClick={() => setShowNewSession(true)}
                  className="w-full px-4 py-3 bg-amber-500 text-slate-900 rounded-xl hover:bg-amber-600 font-medium transition-colors"
                >
                  🎲 Planificar sesión
                </button>
              )}

              {/* New session planner */}
              {showNewSession && (
                <div className="bg-slate-800 rounded-xl border border-amber-500/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-100">Nueva sesión</h3>
                    <button
                      onClick={() => { setShowNewSession(false); setSuggestedGames([]); setAllCandidates([]); }}
                      className="text-slate-400 hover:text-slate-200 text-sm"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  {/* Session params */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nombre (opcional)</label>
                      <input
                        type="text"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        placeholder="Ej: Viernes épico"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Jugadores</label>
                      <select
                        value={sessionPlayers}
                        onChange={(e) => setSessionPlayers(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>{n} jugadores</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Tiempo disponible</label>
                      <select
                        value={sessionHours}
                        onChange={(e) => setSessionHours(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        <option value="1.5">1h 30min</option>
                        <option value="2">2 horas</option>
                        <option value="3">3 horas</option>
                        <option value="4">4 horas</option>
                        <option value="5">5 horas</option>
                        <option value="6">6 horas</option>
                        <option value="8">8 horas</option>
                        <option value="10">10 horas</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleSuggestGames}
                    disabled={loadingSuggestion}
                    className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded-lg text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
                  >
                    {loadingSuggestion ? "Calculando..." : "🎯 Sugerir juegos"}
                  </button>

                  {/* Suggested games */}
                  {allCandidates.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-300">
                          Selecciona los juegos para la sesión
                        </p>
                        <div className="text-sm">
                          <span className={`font-medium ${
                            selectedTotalTime > parseFloat(sessionHours) * 60
                              ? "text-red-400"
                              : "text-emerald-400"
                          }`}>
                            ⏱ {formatDuration(selectedTotalTime)}
                          </span>
                          <span className="text-slate-500"> / {formatDuration(parseFloat(sessionHours) * 60)}</span>
                        </div>
                      </div>

                      {/* Time bar */}
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            selectedTotalTime > parseFloat(sessionHours) * 60
                              ? "bg-red-500"
                              : "bg-emerald-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (selectedTotalTime / (parseFloat(sessionHours) * 60)) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        {allCandidates.map((game) => {
                          const isSelected = selectedGameIds.has(game.gameId);
                          const wasSuggested = suggestedGames.some((g) => g.gameId === game.gameId);
                          return (
                            <button
                              key={game.gameId}
                              onClick={() => toggleGameSelection(game.gameId)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                                isSelected
                                  ? "bg-amber-500/10 border-amber-500/40"
                                  : "bg-slate-800 border-slate-700 hover:border-slate-600"
                              }`}
                            >
                              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-amber-500 border-amber-500 text-slate-900"
                                  : "border-slate-600"
                              }`}>
                                {isSelected && <span className="text-xs font-bold">✓</span>}
                              </div>
                              <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-slate-700">
                                {game.thumbnail ? (
                                  <img src={game.thumbnail} alt={game.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-100 truncate">
                                  {game.name}
                                  {wasSuggested && (
                                    <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                                      sugerido
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2 text-xs text-slate-400 mt-0.5">
                                  <span>⏱ {game.playingTime ? formatDuration(game.playingTime) : "~90min"}</span>
                                  <span>👥 {game.minPlayers}-{game.maxPlayers}</span>
                                  {game.weight && <span>⚖️ {game.weight.toFixed(1)}</span>}
                                  <span className="text-amber-400">{game.score} pts</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleSaveSession}
                        disabled={savingSession || selectedGameIds.size === 0}
                        className="w-full px-4 py-3 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50 transition-colors"
                      >
                        {savingSession
                          ? "Guardando..."
                          : `Crear sesión con ${selectedGameIds.size} juego${selectedGameIds.size !== 1 ? "s" : ""}`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Add games to existing session modal */}
              {editingSessionId && (
                <div className="bg-slate-800 rounded-xl border border-amber-500/30 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">Añadir juegos a la sesión</h3>
                    <button
                      onClick={() => { setEditingSessionId(null); setAllCandidates([]); }}
                      className="text-slate-400 hover:text-slate-200 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {allCandidates.map((game) => {
                      const isSelected = selectedGameIds.has(game.gameId);
                      return (
                        <button
                          key={game.gameId}
                          onClick={() => toggleGameSelection(game.gameId)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-colors text-left ${
                            isSelected
                              ? "bg-amber-500/10 border-amber-500/40"
                              : "bg-slate-800 border-slate-700 hover:border-slate-600"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-amber-500 border-amber-500 text-slate-900" : "border-slate-600"
                          }`}>
                            {isSelected && <span className="text-xs font-bold">✓</span>}
                          </div>
                          <span className="text-sm text-slate-200 flex-1 truncate">{game.name}</span>
                          <span className="text-xs text-slate-400">
                            ⏱ {game.playingTime ? formatDuration(game.playingTime) : "~90min"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedGameIds.size > 0 && (
                    <button
                      onClick={handleConfirmAddGames}
                      className="w-full px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 font-medium text-sm transition-colors"
                    >
                      Añadir {selectedGameIds.size} juego{selectedGameIds.size !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              )}

              {/* Existing sessions */}
              {loadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                </div>
              ) : sessions.length === 0 && !showNewSession ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center text-slate-400">
                  No hay sesiones planificadas. ¡Crea la primera!
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s) => {
                    const sDate = new Date(s.date);
                    const isPast = sDate < new Date();
                    const isExpanded = expandedSessionId === s.id;
                    const totalTime = s.games.reduce(
                      (acc, g) => acc + (g.game.playingTime || 90), 0
                    );
                    const completedGames = s.games.filter((g) => g.status === "completed").length;
                    const statusColors: Record<string, string> = {
                      planned: "bg-blue-500/20 text-blue-300",
                      playing: "bg-emerald-500/20 text-emerald-300",
                      completed: "bg-slate-600/50 text-slate-400",
                    };
                    const statusLabels: Record<string, string> = {
                      planned: "Planificada",
                      playing: "En curso",
                      completed: "Completada",
                    };

                    return (
                      <div
                        key={s.id}
                        className={`bg-slate-800 rounded-xl border transition-colors ${
                          s.status === "playing"
                            ? "border-emerald-500/40"
                            : isPast && s.status !== "completed"
                              ? "border-amber-500/30"
                              : "border-slate-700"
                        }`}
                      >
                        {/* Session header — clickable to expand */}
                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                          className="w-full p-4 flex items-center gap-3 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-100 truncate">
                                {s.name || sDate.toLocaleDateString("es-ES", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                })}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] || statusColors.planned}`}>
                                {statusLabels[s.status] || s.status}
                              </span>
                            </div>
                            <div className="flex gap-3 text-xs text-slate-400 mt-1">
                              <span>📅 {sDate.toLocaleDateString("es-ES")}</span>
                              <span>👥 {s.playerCount}</span>
                              <span>⏱ {formatDuration(s.totalMinutes)}</span>
                              <span>🎲 {s.games.length} juego{s.games.length !== 1 ? "s" : ""}</span>
                              {completedGames > 0 && (
                                <span className="text-emerald-400">✓ {completedGames}/{s.games.length}</span>
                              )}
                            </div>
                          </div>
                          <svg
                            className={`w-5 h-5 text-slate-500 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3">
                            {/* Status controls */}
                            <div className="flex flex-wrap gap-2">
                              {(["planned", "playing", "completed"] as const).map((st) => (
                                <button
                                  key={st}
                                  onClick={() => handleUpdateSession(s.id, { status: st })}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                    s.status === st
                                      ? statusColors[st] + " border-current"
                                      : "bg-slate-700 text-slate-400 border-slate-600 hover:border-slate-500"
                                  }`}
                                >
                                  {statusLabels[st]}
                                </button>
                              ))}
                            </div>

                            {/* Games list with actions */}
                            {s.games.length > 0 ? (
                              <div className="space-y-1.5">
                                {s.games.map((sg, idx) => {
                                  const gameStatusIcon: Record<string, string> = {
                                    pending: "⬜",
                                    playing: "🎮",
                                    completed: "✅",
                                    skipped: "⏭",
                                  };
                                  return (
                                    <div
                                      key={sg.id}
                                      className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors ${
                                        sg.status === "completed"
                                          ? "bg-emerald-500/10"
                                          : sg.status === "playing"
                                            ? "bg-amber-500/10"
                                            : sg.status === "skipped"
                                              ? "bg-slate-700/30 opacity-60"
                                              : "bg-slate-700/50"
                                      }`}
                                    >
                                      <span className="text-xs text-slate-500 w-5 text-center">{idx + 1}.</span>
                                      <div className="w-8 h-8 shrink-0 rounded overflow-hidden bg-slate-700">
                                        {sg.game.thumbnail ? (
                                          <img src={sg.game.thumbnail} alt={sg.game.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">?</div>
                                        )}
                                      </div>
                                      <a
                                        href={`https://boardgamegeek.com/boardgame/${sg.game.bggId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-slate-200 flex-1 truncate hover:text-amber-300 transition-colors"
                                      >
                                        {sg.game.name}
                                      </a>
                                      <span className="text-xs text-slate-400 shrink-0">
                                        ⏱ {sg.game.playingTime ? formatDuration(sg.game.playingTime) : "~90min"}
                                      </span>

                                      {/* Game status buttons */}
                                      <div className="flex gap-1 shrink-0">
                                        {(["pending", "playing", "completed", "skipped"] as const).map((gs) => (
                                          <button
                                            key={gs}
                                            onClick={() => handleGameStatus(s.id, sg.id, gs)}
                                            className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors ${
                                              sg.status === gs
                                                ? "bg-slate-600 ring-1 ring-amber-500/50"
                                                : "hover:bg-slate-600"
                                            }`}
                                            title={gs === "pending" ? "Pendiente" : gs === "playing" ? "Jugando" : gs === "completed" ? "Jugado" : "Saltado"}
                                          >
                                            {gameStatusIcon[gs]}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Remove from session */}
                                      <button
                                        onClick={() => handleRemoveGameFromSession(s.id, sg.game.id)}
                                        className="text-slate-600 hover:text-red-400 text-xs transition-colors shrink-0"
                                        title="Quitar de la sesión"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-xs text-slate-500">
                                    Total estimado: {formatDuration(totalTime)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">Sin juegos asignados</p>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleAddGameToSession(s.id)}
                                className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors"
                              >
                                + Añadir juego
                              </button>
                              <button
                                onClick={() => handleDeleteSession(s.id)}
                                className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
                              >
                                Eliminar sesión
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ Members Tab ═══════════ */}
          {activeTab === "members" && (
            <div className="space-y-6">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Miembros</h2>
                <div className="space-y-3">
                  {group.members.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0"
                    >
                      <div>
                        <span className="font-medium text-slate-100">
                          {member.user.name
                            ? `${member.user.name} ${member.user.surname || ""}`
                            : member.user.email}
                        </span>
                        <span className="text-sm text-slate-500 ml-2">{member.user.email}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          member.role === "admin"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {member.role === "admin" ? "Admin" : "Miembro"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Invitar miembro</h2>
                <form onSubmit={handleInvite} className="flex gap-3">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium text-sm"
                  >
                    {inviting ? "Enviando..." : "Invitar"}
                  </button>
                </form>
                {inviteMsg && <p className="text-sm text-green-400 mt-2">{inviteMsg}</p>}
                {inviteError && <p className="text-sm text-red-400 mt-2">{inviteError}</p>}
              </div>

              {group.invitations.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h2 className="text-lg font-semibold text-slate-100 mb-4">Invitaciones pendientes</h2>
                  <div className="space-y-2">
                    {group.invitations.map((inv) => (
                      <div
                        key={inv.email}
                        className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0"
                      >
                        <span className="text-sm text-slate-300">{inv.email}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(inv.createdAt).toLocaleDateString("es-ES")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
