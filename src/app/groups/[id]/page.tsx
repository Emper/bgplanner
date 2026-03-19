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
  bggRating: number | null;
  bggRank: number | null;
  weight: number | null;
}

interface RankedGame {
  groupGameId: string;
  game: Game;
  addedBy: { name: string | null };
  score: number;
  upVotes: number;
  superVotes: number;
  downVotes: number;
  userVote: "up" | "super" | "down" | null;
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
}

interface PlayerCountRec {
  numPlayers: string;
  best: number;
  recommended: number;
  notRecommended: number;
  verdict: "Best" | "Recommended" | "Not Recommended";
}

type Tab = "ranking" | "members";

export default function GroupDashboardPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [ranking, setRanking] = useState<RankedGame[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [playerRecs, setPlayerRecs] = useState<Record<number, PlayerCountRec | null>>({});
  const [activeTab, setActiveTab] = useState<Tab>("ranking");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingGame, setVotingGame] = useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, rankingRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`, { credentials: "include" }),
        fetch(`/api/groups/${groupId}/ranking`, { credentials: "include" }),
      ]);

      if (!groupRes.ok || !rankingRes.ok) {
        throw new Error("Error al cargar el grupo");
      }

      const groupData = await groupRes.json();
      const rankingData = await rankingRes.json();

      setGroup(groupData);
      setRanking(rankingData.ranking);
      setMemberCount(rankingData.memberCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch player count recommendations for each game
  useEffect(() => {
    if (ranking.length === 0 || memberCount === 0) return;

    ranking.forEach(async (item) => {
      const bggId = item.game.bggId;
      if (playerRecs[bggId] !== undefined) return;

      // Mark as loading
      setPlayerRecs((prev) => ({ ...prev, [bggId]: null }));

      try {
        const res = await fetch(`/api/bgg/game/${bggId}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();

        const rec = data.playerCountRecommendations?.find(
          (r: PlayerCountRec) => r.numPlayers === String(memberCount)
        );
        setPlayerRecs((prev) => ({ ...prev, [bggId]: rec || null }));
      } catch {
        // Silently fail for player count recs
      }
    });
  }, [ranking, memberCount, playerRecs]);

  const handleVote = async (
    gameId: string,
    gameDbId: string,
    type: "up" | "super" | "down",
    currentVote: string | null
  ) => {
    setVotingGame(gameDbId);

    try {
      if (currentVote === type) {
        // Remove vote
        const res = await fetch(
          `/api/groups/${groupId}/games/${gameId}/vote`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );
        if (!res.ok) throw new Error("Error al eliminar voto");
      } else {
        // Cast vote
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
            // Remove old super vote first
            const oldGameId = data.existingSuperGameId;
            await fetch(
              `/api/groups/${groupId}/games/${oldGameId}/vote`,
              {
                method: "DELETE",
                credentials: "include",
              }
            );
            // Now cast the new super vote
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

      // Refresh ranking
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
      // Refresh group to update pending invitations
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
            <button
              onClick={() => setActiveTab("ranking")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "ranking"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Ranking
            </button>
            <button
              onClick={() => setActiveTab("members")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "members"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Miembros
            </button>
          </div>

          {/* Ranking Tab */}
          {activeTab === "ranking" && (
            <div>
              <div className="flex justify-end mb-4">
                <Link
                  href={`/groups/${groupId}/add-games`}
                  className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-600 text-sm font-medium"
                >
                  Añadir juegos
                </Link>
              </div>

              {ranking.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center text-slate-400">
                  No hay juegos en este grupo todavía. ¡Añade algunos!
                </div>
              ) : (
                <div className="space-y-3">
                  {ranking.map((item, index) => {
                    const rec = playerRecs[item.game.bggId];
                    return (
                      <div
                        key={item.groupGameId}
                        className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center gap-4"
                      >
                        {/* Rank */}
                        <div className="text-lg font-bold text-slate-500 w-8 text-center shrink-0">
                          #{index + 1}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-700">
                          {item.game.thumbnail ? (
                            <img
                              src={item.game.thumbnail}
                              alt={item.game.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                              Sin img
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-100 truncate">
                            {item.game.name}
                            {item.game.yearPublished && (
                              <span className="text-slate-500 font-normal ml-1">
                                ({item.game.yearPublished})
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-1">
                            {item.game.bggRating && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                                BGG {item.game.bggRating.toFixed(1)}
                              </span>
                            )}
                            {item.game.weight && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                                Peso: {item.game.weight.toFixed(1)}
                              </span>
                            )}
                            {(item.game.minPlayers || item.game.maxPlayers) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                                {item.game.minPlayers === item.game.maxPlayers
                                  ? `${item.game.minPlayers} jugadores`
                                  : `${item.game.minPlayers || "?"}-${item.game.maxPlayers || "?"} jugadores`}
                              </span>
                            )}
                            {rec && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  rec.verdict === "Best"
                                    ? "bg-green-500/20 text-green-300"
                                    : rec.verdict === "Recommended"
                                      ? "bg-yellow-500/20 text-yellow-300"
                                      : "bg-red-500/20 text-red-300"
                                }`}
                              >
                                {rec.verdict === "Best"
                                  ? "Best"
                                  : rec.verdict === "Recommended"
                                    ? "Recomendado"
                                    : "No recomendado"}{" "}
                                con {memberCount}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-center shrink-0">
                          <div className="text-xl font-bold text-slate-100">
                            {item.score}
                          </div>
                          <div className="text-xs text-slate-500">puntos</div>
                        </div>

                        {/* Vote buttons */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() =>
                              handleVote(
                                item.game.id,
                                item.groupGameId,
                                "up",
                                item.userVote
                              )
                            }
                            disabled={votingGame === item.groupGameId}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg border text-lg transition-colors disabled:opacity-50 ${
                              item.userVote === "up"
                                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                                : "border-slate-700 text-slate-500 hover:bg-slate-700"
                            }`}
                            title="+1"
                          >
                            👍
                          </button>
                          <button
                            onClick={() =>
                              handleVote(
                                item.game.id,
                                item.groupGameId,
                                "super",
                                item.userVote
                              )
                            }
                            disabled={votingGame === item.groupGameId}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg border text-lg transition-colors disabled:opacity-50 ${
                              item.userVote === "super"
                                ? "bg-orange-500/20 border-orange-500 text-orange-400"
                                : "border-slate-700 text-slate-500 hover:bg-slate-700"
                            }`}
                            title="+3 (Super voto)"
                          >
                            🔥
                          </button>
                          <button
                            onClick={() =>
                              handleVote(
                                item.game.id,
                                item.groupGameId,
                                "down",
                                item.userVote
                              )
                            }
                            disabled={votingGame === item.groupGameId}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg border text-lg transition-colors disabled:opacity-50 ${
                              item.userVote === "down"
                                ? "bg-red-500/20 border-red-500 text-red-400"
                                : "border-slate-700 text-slate-500 hover:bg-slate-700"
                            }`}
                            title="-1"
                          >
                            👎
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <div className="space-y-6">
              {/* Members list */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">
                  Miembros
                </h2>
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
                        <span className="text-sm text-slate-500 ml-2">
                          {member.user.email}
                        </span>
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

              {/* Invite form */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-4">
                  Invitar miembro
                </h2>
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
                {inviteMsg && (
                  <p className="text-sm text-green-400 mt-2">{inviteMsg}</p>
                )}
                {inviteError && (
                  <p className="text-sm text-red-400 mt-2">{inviteError}</p>
                )}
              </div>

              {/* Pending invitations */}
              {group.invitations.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h2 className="text-lg font-semibold text-slate-100 mb-4">
                    Invitaciones pendientes
                  </h2>
                  <div className="space-y-2">
                    {group.invitations.map((inv) => (
                      <div
                        key={inv.email}
                        className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0"
                      >
                        <span className="text-sm text-slate-300">
                          {inv.email}
                        </span>
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
