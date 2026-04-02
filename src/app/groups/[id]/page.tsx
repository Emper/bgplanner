"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Avatar from "@/components/Avatar";
import { formatDuration } from "@/lib/format";

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

interface Voter {
  name: string;
  type: "up" | "super" | "down";
  points: number;
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
  voters: Voter[];
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
    avatarUrl: string | null;
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
  inviteCode: string | null;
  inviteEnabled: boolean;
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


export default function GroupDashboardWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500">Cargando...</div>}>
      <GroupDashboardPage />
    </Suspense>
  );
}

function GroupDashboardPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [ranking, setRanking] = useState<RankedGame[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    return tab === "sessions" || tab === "members" ? tab : "ranking";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingGame, setRemovingGame] = useState<string | null>(null);
  const [openVoteTooltip, setOpenVoteTooltip] = useState<string | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<GameSessionData[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    searchParams.get("session")
  );
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

  // Invite link state
  const [inviteLinkCode, setInviteLinkCode] = useState<string | null>(null);
  const [inviteLinkEnabled, setInviteLinkEnabled] = useState(true);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  // Sync tab and session to URL
  const updateUrl = useCallback((tab: Tab, sessionId: string | null) => {
    const params = new URLSearchParams();
    if (tab !== "ranking") params.set("tab", tab);
    if (sessionId) params.set("session", sessionId);
    const query = params.toString();
    router.replace(`/groups/${groupId}${query ? `?${query}` : ""}`, { scroll: false });
  }, [router, groupId]);

  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setExpandedSessionId(null);
    updateUrl(tab, null);
  }, [updateUrl]);

  const toggleSession = useCallback((sessionId: string) => {
    const newId = expandedSessionId === sessionId ? null : sessionId;
    setExpandedSessionId(newId);
    updateUrl(activeTab, newId);
  }, [expandedSessionId, activeTab, updateUrl]);

  // Close mobile vote tooltip when tapping outside
  useEffect(() => {
    if (!openVoteTooltip) return;
    const handleClick = () => setOpenVoteTooltip(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openVoteTooltip]);

  const fetchData = useCallback(async () => {
    try {
      // Single API call loads everything: group, ranking, sessions
      const res = await fetch(`/api/groups/${groupId}/dashboard`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Error al cargar el grupo");
      }

      const data = await res.json();

      setGroup(data.group);
      setRanking(data.ranking);
      setMemberCount(data.memberCount);
      setSessions(data.sessions);
      if (data.group) {
        setInviteLinkCode(data.group.inviteCode);
        setInviteLinkEnabled(data.group.inviteEnabled ?? true);
      }
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
  // Split into pending (not yet played) and played
  const pendingGames = ranking.filter((item) => item.playCount === 0);
  const playedGames = ranking.filter((item) => item.playCount > 0);

  const canRemoveGame = (item: RankedGame) =>
    group?.currentUserRole === "admin" || item.addedById === group?.currentUserId;

  // Helper: recompute ranking scores & sort after a local vote change
  const applyVoteLocally = useCallback(
    (
      prev: RankedGame[],
      targetGameDbId: string,
      newVote: "up" | "super" | "down" | null,
      oldVote: "up" | "super" | "down" | null
    ): RankedGame[] => {
      const voteScore = (t: string) => (t === "super" ? 3 : t === "down" ? -1 : 1);
      return prev
        .map((item) => {
          if (item.groupGameId !== targetGameDbId) return item;
          let { score, upVotes, superVotes, downVotes } = item;
          // Remove old vote contribution
          if (oldVote) {
            score -= voteScore(oldVote);
            if (oldVote === "up") upVotes--;
            else if (oldVote === "super") superVotes--;
            else if (oldVote === "down") downVotes--;
          }
          // Add new vote contribution
          if (newVote) {
            score += voteScore(newVote);
            if (newVote === "up") upVotes++;
            else if (newVote === "super") superVotes++;
            else if (newVote === "down") downVotes++;
          }
          return { ...item, score, upVotes, superVotes, downVotes, userVote: newVote };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return (b.game.bggRating || 0) - (a.game.bggRating || 0);
        });
    },
    []
  );

  const handleVote = async (
    gameId: string,
    gameDbId: string,
    type: "up" | "super" | "down",
    currentVote: string | null
  ) => {
    const isRemove = currentVote === type;
    const newVote = isRemove ? null : type;
    const snapshot = ranking; // save for rollback

    // ── Super vote with existing super → ask FIRST, then update ──
    const existingSuper = type === "super" && !isRemove
      ? ranking.find((r) => r.userVote === "super" && r.groupGameId !== gameDbId)
      : null;

    if (existingSuper) {
      // Don't touch UI yet — wait for user decision
      const move = confirm(
        "Ya tienes un super voto en otro juego de este grupo. ¿Quieres moverlo a este juego?"
      );
      if (!move) return;

      // User confirmed — apply both changes optimistically
      setRanking((prev) => {
        let next = applyVoteLocally(prev, existingSuper.groupGameId, null, "super");
        next = applyVoteLocally(next, gameDbId, "super", currentVote as RankedGame["userVote"]);
        return next;
      });

      // Fire API calls
      try {
        await fetch(
          `/api/groups/${groupId}/games/${existingSuper.game.id}/vote`,
          { method: "DELETE", credentials: "include" }
        );
        const res = await fetch(
          `/api/groups/${groupId}/games/${gameId}/vote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ type: "super" }),
          }
        );
        if (!res.ok) throw new Error();
      } catch {
        setRanking(snapshot);
        alert("Error al mover el super voto");
      }
      return;
    }

    // ── Normal vote: optimistic update immediately ──
    setRanking((prev) => applyVoteLocally(prev, gameDbId, newVote, currentVote as RankedGame["userVote"]));

    try {
      if (isRemove) {
        const res = await fetch(
          `/api/groups/${groupId}/games/${gameId}/vote`,
          { method: "DELETE", credentials: "include" }
        );
        if (!res.ok) throw new Error();
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
        if (!res.ok) throw new Error();
      }
    } catch {
      setRanking(snapshot);
      alert("Error al procesar el voto");
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
    // ── Optimistic update ──
    const snapshot = sessions;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, games: s.games.map((g) => (g.id === gameSessionGameId ? { ...g, status: newStatus } : g)) }
          : s
      )
    );

    try {
      const res = await fetch(`/api/groups/${groupId}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gameStatuses: { [gameSessionGameId]: newStatus } }),
      });
      if (!res.ok) throw new Error();
      // Reconcile with server response
      const updated = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch {
      setSessions(snapshot); // rollback
      alert("Error al actualizar estado");
    }
  };

  const handleRemoveGameFromSession = async (sessionId: string, gameIdToRemove: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const remainingIds = session.games
      .filter((g) => g.game.id !== gameIdToRemove)
      .map((g) => g.game.id);
    await handleUpdateSession(sessionId, { gameIds: remainingIds });
  };

  const handleReorderGame = async (sessionId: string, currentIndex: number, direction: "up" | "down") => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const gameIds = session.games.map((g) => g.game.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= gameIds.length) return;
    [gameIds[currentIndex], gameIds[targetIndex]] = [gameIds[targetIndex], gameIds[currentIndex]];
    await handleUpdateSession(sessionId, { gameIds });
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
      <div className="min-h-screen bg-slate-900 py-4 sm:py-6 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">{group.name}</h1>
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
                onClick={() => switchTab(tab)}
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
              {ranking.length === 0 ? (
                <div className="text-center">
                  <div className="flex items-center justify-end mb-4">
                    <Link
                      href={`/groups/${groupId}/add-games${(() => {
                        const firstBgg = group.members.find((m) => m.user.bggUsername)?.user.bggUsername;
                        return firstBgg ? `?user=${encodeURIComponent(firstBgg)}` : "";
                      })()}`}
                      prefetch={false}
                      className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 text-sm font-medium shrink-0"
                    >
                      Añadir juegos
                    </Link>
                  </div>
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-slate-400">
                    No hay juegos en este grupo todavía. ¡Añade algunos!
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ── Pending games (not yet played) ── */}
                  {pendingGames.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                          Pendientes de jugar ({pendingGames.length})
                        </h3>
                        <Link
                          href={`/groups/${groupId}/add-games${(() => {
                            const firstBgg = group.members.find((m) => m.user.bggUsername)?.user.bggUsername;
                            return firstBgg ? `?user=${encodeURIComponent(firstBgg)}` : "";
                          })()}`}
                          prefetch={false}
                          className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 text-sm font-medium shrink-0"
                        >
                          Añadir juegos
                        </Link>
                      </div>
                      <div className="space-y-3">
                        {pendingGames.map((item, index) => (
                          <div
                            key={item.groupGameId}
                            className="bg-slate-800 rounded-xl border border-slate-700 p-3 sm:p-4"
                          >
                            {/* Main row: Position + Thumbnail + Name/Badges + Votes+Score */}
                            <div className="flex items-center gap-2 sm:gap-4">
                              {/* Position badge — medals for top 3 */}
                              <div className="w-7 sm:w-10 shrink-0 flex justify-center">
                                {index < 3 ? (
                                    <svg className="w-6 h-6 sm:w-9 sm:h-9" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <defs>
                                        {index === 0 && (
                                          <linearGradient id="medal-gold" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                                            <stop offset="0%" stopColor="#fbbf24" />
                                            <stop offset="50%" stopColor="#f59e0b" />
                                            <stop offset="100%" stopColor="#d97706" />
                                          </linearGradient>
                                        )}
                                        {index === 1 && (
                                          <linearGradient id="medal-silver" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                                            <stop offset="0%" stopColor="#e2e8f0" />
                                            <stop offset="50%" stopColor="#94a3b8" />
                                            <stop offset="100%" stopColor="#64748b" />
                                          </linearGradient>
                                        )}
                                        {index === 2 && (
                                          <linearGradient id="medal-bronze" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                                            <stop offset="0%" stopColor="#d97756" />
                                            <stop offset="50%" stopColor="#b45930" />
                                            <stop offset="100%" stopColor="#92400e" />
                                          </linearGradient>
                                        )}
                                      </defs>
                                      <circle cx="18" cy="18" r="16" fill={`url(#medal-${index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze'})`} opacity="0.15" />
                                      <circle cx="18" cy="18" r="16" stroke={`url(#medal-${index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze'})`} strokeWidth="2" fill="none" />
                                      <text x="18" y="24" textAnchor="middle" fontSize="16" fontWeight="800" fill={index === 0 ? '#fbbf24' : index === 1 ? '#cbd5e1' : '#d97756'}>
                                        {index + 1}
                                      </text>
                                    </svg>
                                ) : (
                                  <span className="text-sm sm:text-base font-bold text-slate-500">#{index + 1}</span>
                                )}
                              </div>
                              {/* Thumbnail: 130px for top 3, 100px for rest on desktop */}
                              <div className={`w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-slate-700 ${index < 3 ? 'sm:w-[130px] sm:h-[130px]' : 'sm:w-[100px] sm:h-[100px]'}`}>
                                {item.game.thumbnail ? (
                                  <img src={item.game.thumbnail} alt={item.game.name} className="w-full h-full object-contain" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-100 text-sm sm:text-base leading-tight">
                                  <a
                                    href={`https://boardgamegeek.com/boardgame/${item.game.bggId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-amber-300 transition-colors"
                                  >
                                    {item.game.name}
                                  </a>
                                  {item.game.yearPublished && (
                                    <span className="text-slate-500 font-normal ml-1 text-xs">({item.game.yearPublished})</span>
                                  )}
                                </div>
                                {/* Badges inline on desktop */}
                                <div className="hidden sm:flex flex-wrap gap-1.5 mt-2">
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
                              {/* Desktop: Vote buttons + Score, vertically centered */}
                              <div className="hidden sm:flex items-center gap-3 shrink-0">
                                <div className="flex gap-1.5">
                                  {(["up", "super", "down"] as const).map((type) => (
                                    <button
                                      key={type}
                                      onClick={() => handleVote(item.game.id, item.groupGameId, type, item.userVote)}
                                      className={`w-9 h-9 flex items-center justify-center rounded-lg border text-lg transition-colors ${
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
                                <div className="relative group/score text-center w-12 cursor-default">
                                  <div className="text-xl font-bold text-slate-100">{item.score}</div>
                                  <div className="text-xs text-slate-500">pts</div>
                                  {/* Tooltip with voter breakdown */}
                                  {item.voters.length > 0 && (
                                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover/score:block z-50">
                                      <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-xl p-3 min-w-[180px] text-left">
                                        <div className="text-xs font-semibold text-slate-300 mb-2">Votos</div>
                                        <div className="space-y-1.5">
                                          {item.voters.map((voter, vi) => (
                                            <div key={vi} className="flex items-center justify-between gap-3 text-xs">
                                              <span className="text-slate-300 truncate max-w-[120px]">{voter.name}</span>
                                              <span className={`font-bold whitespace-nowrap ${voter.type === 'super' ? 'text-orange-400' : voter.type === 'down' ? 'text-red-400' : 'text-amber-400'}`}>
                                                {voter.points > 0 ? '+' : ''}{voter.points}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="border-t border-slate-700 mt-2 pt-1.5 flex justify-between text-xs font-bold">
                                          <span className="text-slate-400">Total</span>
                                          <span className="text-slate-100">{item.score}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Mobile: Score with tap-to-toggle tooltip */}
                              <div className="relative text-center shrink-0 sm:hidden">
                                <div
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenVoteTooltip(openVoteTooltip === item.groupGameId ? null : item.groupGameId);
                                  }}
                                >
                                  <div className="text-lg font-bold text-slate-100">{item.score}</div>
                                  <div className="text-[10px] text-slate-500">pts</div>
                                </div>
                                {item.voters.length > 0 && openVoteTooltip === item.groupGameId && (
                                  <div className="absolute bottom-full right-0 mb-2 z-50">
                                    <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-xl p-3 min-w-[160px] text-left">
                                      <div className="text-xs font-semibold text-slate-300 mb-2">Votos</div>
                                      <div className="space-y-1.5">
                                        {item.voters.map((voter, vi) => (
                                          <div key={vi} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="text-slate-300 truncate max-w-[100px]">{voter.name}</span>
                                            <span className={`font-bold whitespace-nowrap ${voter.type === 'super' ? 'text-orange-400' : voter.type === 'down' ? 'text-red-400' : 'text-amber-400'}`}>
                                              {voter.points > 0 ? '+' : ''}{voter.points}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="border-t border-slate-700 mt-2 pt-1.5 flex justify-between text-xs font-bold">
                                        <span className="text-slate-400">Total</span>
                                        <span className="text-slate-100">{item.score}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2 mobile only: Badges + Vote buttons */}
                            <div className="flex sm:hidden items-center justify-between mt-2 gap-2 pl-8">
                              <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                                {item.game.bggRating && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-300">
                                    ★ {item.game.bggRating.toFixed(1)}
                                  </span>
                                )}
                                {item.game.playingTime && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                                    ⏱ {formatDuration(item.game.playingTime)}
                                  </span>
                                )}
                                {item.game.weight && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300">
                                    ⚖️ {item.game.weight.toFixed(1)}
                                  </span>
                                )}
                                {(item.game.minPlayers || item.game.maxPlayers) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700 text-slate-300">
                                    {item.game.minPlayers === item.game.maxPlayers
                                      ? `${item.game.minPlayers}p`
                                      : `${item.game.minPlayers || "?"}-${item.game.maxPlayers || "?"}p`}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                {(["up", "super", "down"] as const).map((type) => (
                                  <button
                                    key={type}
                                    onClick={() => handleVote(item.game.id, item.groupGameId, type, item.userVote)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border text-base transition-colors ${
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
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-600 hover:text-red-400 hover:border-red-500/50 transition-colors disabled:opacity-50"
                                    title="Eliminar del grupo"
                                  >
                                    🗑
                                  </button>
                                )}
                              </div>
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
                            className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-3"
                          >
                            {/* Row 1: Thumbnail + Name + Score */}
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-lg overflow-hidden bg-slate-700">
                                {item.game.thumbnail ? (
                                  <img src={item.game.thumbnail} alt={item.game.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-300 text-sm leading-tight">
                                  <a
                                    href={`https://boardgamegeek.com/boardgame/${item.game.bggId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-amber-300 transition-colors"
                                  >
                                    {item.game.name}
                                  </a>
                                </div>
                                <div className="hidden sm:flex flex-wrap gap-1.5 mt-0.5">
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
                                <div className="text-base sm:text-lg font-bold text-slate-400">{item.score}</div>
                                <div className="text-[10px] sm:text-xs text-slate-600">pts</div>
                              </div>
                            </div>

                            {/* Row 2: Badges (mobile) + Vote buttons */}
                            <div className="flex items-center justify-between mt-1.5 gap-2 pl-12 sm:pl-15">
                              <div className="flex sm:hidden flex-wrap gap-1 flex-1 min-w-0">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                                  {item.playCount} partida{item.playCount !== 1 && "s"}
                                </span>
                                {item.game.bggRating && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400/70">
                                    ★ {item.game.bggRating.toFixed(1)}
                                  </span>
                                )}
                                {item.game.playingTime && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-400">
                                    ⏱ {formatDuration(item.game.playingTime)}
                                  </span>
                                )}
                              </div>
                              <div className="hidden sm:block flex-1" />
                              <div className="flex gap-1 shrink-0">
                                {(["up", "super", "down"] as const).map((type) => (
                                  <button
                                    key={type}
                                    onClick={() => handleVote(item.game.id, item.groupGameId, type, item.userVote)}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border text-sm sm:text-base transition-colors ${
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
                                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-600 hover:text-red-400 hover:border-red-500/50 transition-colors disabled:opacity-50"
                                    title="Eliminar del grupo"
                                  >
                                    🗑
                                  </button>
                                )}
                              </div>
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
                          onClick={() => toggleSession(s.id)}
                          className="w-full p-3 sm:p-4 flex items-center gap-2 sm:gap-3 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                                {s.name || sDate.toLocaleDateString("es-ES", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                })}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium shrink-0 ${statusColors[s.status] || statusColors.planned}`}>
                                {statusLabels[s.status] || s.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-slate-400 mt-1">
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
                                      className={`py-2 px-2 sm:px-3 rounded-lg transition-colors ${
                                        sg.status === "completed"
                                          ? "bg-emerald-500/10"
                                          : sg.status === "playing"
                                            ? "bg-amber-500/10"
                                            : sg.status === "skipped"
                                              ? "bg-slate-700/30 opacity-60"
                                              : "bg-slate-700/50"
                                      }`}
                                    >
                                      {/* Row 1: Reorder + Index + Thumbnail + Name + Time */}
                                      <div className="flex items-center gap-2">
                                        <div className="flex flex-col gap-0.5 shrink-0">
                                          <button
                                            disabled={idx === 0}
                                            onClick={() => handleReorderGame(s.id, idx, "up")}
                                            className="text-slate-500 hover:text-amber-400 disabled:opacity-20 text-base leading-none transition-colors p-0.5"
                                            title="Mover arriba"
                                          >▲</button>
                                          <button
                                            disabled={idx === s.games.length - 1}
                                            onClick={() => handleReorderGame(s.id, idx, "down")}
                                            className="text-slate-500 hover:text-amber-400 disabled:opacity-20 text-base leading-none transition-colors p-0.5"
                                            title="Mover abajo"
                                          >▼</button>
                                        </div>
                                        <span className="text-xs text-slate-500 w-4 text-center shrink-0">{idx + 1}.</span>
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded overflow-hidden bg-slate-700">
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
                                          className="text-xs sm:text-sm text-slate-200 flex-1 min-w-0 truncate hover:text-amber-300 transition-colors"
                                        >
                                          {sg.game.name}
                                        </a>
                                        <span className="text-[10px] sm:text-xs text-slate-400 shrink-0">
                                          ⏱ {sg.game.playingTime ? formatDuration(sg.game.playingTime) : "~90min"}
                                        </span>
                                      </div>
                                      {/* Row 2: Status buttons + Remove */}
                                      <div className="flex items-center justify-end gap-1 mt-1 pl-6 sm:pl-8">
                                        {(["pending", "playing", "completed", "skipped"] as const).map((gs) => (
                                          <button
                                            key={gs}
                                            onClick={() => handleGameStatus(s.id, sg.id, gs)}
                                            className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded text-xs sm:text-sm transition-colors ${
                                              sg.status === gs
                                                ? "bg-slate-600 ring-1 ring-amber-500/50"
                                                : "hover:bg-slate-600"
                                            }`}
                                            title={gs === "pending" ? "Pendiente" : gs === "playing" ? "Jugando" : gs === "completed" ? "Jugado" : "Saltado"}
                                          >
                                            {gameStatusIcon[gs]}
                                          </button>
                                        ))}
                                        <button
                                          onClick={() => handleRemoveGameFromSession(s.id, sg.game.id)}
                                          className="text-slate-600 hover:text-red-400 text-xs transition-colors shrink-0 ml-1"
                                          title="Quitar de la sesión"
                                        >
                                          ✕
                                        </button>
                                      </div>
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
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={member.user.name || member.user.email}
                          avatarUrl={member.user.avatarUrl}
                          size="sm"
                        />
                        <div>
                          <span className="font-medium text-slate-100">
                            {member.user.name
                              ? `${member.user.name} ${member.user.surname || ""}`
                              : member.user.email}
                          </span>
                          <span className="text-sm text-slate-500 ml-2">{member.user.email}</span>
                        </div>
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

              {/* Enlace de invitación */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Enlace de invitación</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Comparte este enlace para que cualquiera pueda unirse al grupo.
                </p>

                {inviteLinkCode ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteLinkCode}`}
                        className="flex-1 min-w-0 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-xs sm:text-sm font-mono truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/join/${inviteLinkCode}`);
                          setInviteLinkCopied(true);
                          setTimeout(() => setInviteLinkCopied(false), 2000);
                        }}
                        className="px-3 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 font-medium text-sm whitespace-nowrap"
                      >
                        {inviteLinkCopied ? "¡Copiado!" : "Copiar"}
                      </button>
                    </div>

                    {group.currentUserRole === "admin" && (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setInviteLinkLoading(true);
                              try {
                                const res = await fetch(`/api/groups/${groupId}/invite-link`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({ enabled: !inviteLinkEnabled }),
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  setInviteLinkEnabled(data.inviteEnabled);
                                }
                              } finally {
                                setInviteLinkLoading(false);
                              }
                            }}
                            disabled={inviteLinkLoading}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              inviteLinkEnabled ? "bg-amber-500" : "bg-slate-600"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                inviteLinkEnabled ? "translate-x-5" : ""
                              }`}
                            />
                          </button>
                          <span className="text-sm text-slate-400">
                            {inviteLinkEnabled ? "Activo" : "Desactivado"}
                          </span>
                        </div>

                        <button
                          onClick={async () => {
                            if (!confirm("¿Regenerar el enlace? El anterior dejará de funcionar.")) return;
                            setInviteLinkLoading(true);
                            try {
                              const res = await fetch(`/api/groups/${groupId}/invite-link`, {
                                method: "POST",
                                credentials: "include",
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setInviteLinkCode(data.inviteCode);
                                setInviteLinkEnabled(data.inviteEnabled);
                              }
                            } finally {
                              setInviteLinkLoading(false);
                            }
                          }}
                          disabled={inviteLinkLoading}
                          className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
                        >
                          Regenerar enlace
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {group.currentUserRole === "admin" ? (
                      <button
                        onClick={async () => {
                          setInviteLinkLoading(true);
                          try {
                            const res = await fetch(`/api/groups/${groupId}/invite-link`, {
                              method: "POST",
                              credentials: "include",
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setInviteLinkCode(data.inviteCode);
                              setInviteLinkEnabled(data.inviteEnabled);
                            }
                          } finally {
                            setInviteLinkLoading(false);
                          }
                        }}
                        disabled={inviteLinkLoading}
                        className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium text-sm"
                      >
                        {inviteLinkLoading ? "Generando..." : "Generar enlace de invitación"}
                      </button>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No hay enlace de invitación activo. Solo un admin puede generarlo.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">Invitar por email</h2>
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
