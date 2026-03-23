"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import BggGameSearch from "@/components/BggGameSearch";

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
  weight: number | null;
}

interface Interest {
  id: string;
  eventGameId: string;
  attendeeId: string;
  intensity: number;
  notes: string | null;
  userName: string;
  userId: string;
}

interface EventGame {
  id: string;
  eventId: string;
  gameId: string;
  game: Game;
  interests: Interest[];
}

interface Attendee {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  user: { id: string; name: string | null; surname: string | null; email: string };
}

interface EventData {
  id: string;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  location: string | null;
  maxAttendees: number | null;
  visibility: string;
  inviteCode: string | null;
  createdById: string;
  createdBy: { id: string; name: string | null; email: string };
  games: EventGame[];
  attendees: Attendee[];
  currentUserId: string;
  isCreator: boolean;
  currentAttendeeId: string | null;
}

type Tab = "games" | "mylist" | "attendees";

const INTENSITY_LABELS: Record<number, string> = {
  5: "Máxima prioridad",
  4: "Tengo que probarlo",
  3: "Me encantaría",
  2: "Si surge, me va bien",
  1: "Solo si no queda otra",
};

const INTENSITY_COLORS: Record<number, string> = {
  5: "bg-red-500/20 text-red-300 border-red-500",
  4: "bg-orange-500/20 text-orange-300 border-orange-500",
  3: "bg-amber-500/20 text-amber-300 border-amber-500",
  2: "bg-blue-500/20 text-blue-300 border-blue-500",
  1: "bg-slate-700 text-slate-300 border-slate-600",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function EventDetailPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("games");
  const [addingGame, setAddingGame] = useState(false);
  const [joiningEvent, setJoiningEvent] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) {
        router.push("/events");
        return;
      }
      const data = await res.json();
      setEvent(data);
      if (data.inviteCode) setInviteCode(data.inviteCode);
    } catch {
      router.push("/events");
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleAddGame = async (game: { bggId: number; name?: string }) => {
    setAddingGame(true);
    try {
      const res = await fetch(`/api/events/${eventId}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bggId: game.bggId, name: game.name }),
      });
      if (res.ok) {
        const newEventGame = await res.json();
        // Optimistic: add game to local state immediately
        setEvent((prev) => prev ? {
          ...prev,
          games: [...prev.games, { ...newEventGame, interests: [] }],
        } : prev);
      }
    } finally {
      setAddingGame(false);
    }
  };

  const handleRemoveGame = async (gameId: string) => {
    if (!confirm("¿Eliminar este juego del evento?")) return;
    // Optimistic: remove from UI immediately
    setEvent((prev) => prev ? {
      ...prev,
      games: prev.games.filter((eg) => eg.game.id !== gameId),
    } : prev);
    await fetch(`/api/events/${eventId}/games/${gameId}`, { method: "DELETE" });
  };

  const handleJoin = async () => {
    setJoiningEvent(true);
    try {
      const res = await fetch(`/api/events/${eventId}/attend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "attending" }),
      });
      if (res.ok) {
        // Need full refresh to get attendeeId
        fetchEvent();
      }
    } finally {
      setJoiningEvent(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm("¿Desapuntarte del evento?")) return;
    // Optimistic: remove from UI
    setEvent((prev) => prev ? {
      ...prev,
      attendees: prev.attendees.filter((a) => a.userId !== prev.currentUserId),
      currentAttendeeId: null,
    } : prev);
    await fetch(`/api/events/${eventId}/attend`, { method: "DELETE" });
  };

  const handleSetInterest = async (eventGameId: string, intensity: number) => {
    if (!event) return;
    // Optimistic update
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        games: prev.games.map((eg) => {
          if (eg.id !== eventGameId) return eg;
          const existing = eg.interests.find((i) => i.attendeeId === prev.currentAttendeeId);
          if (existing) {
            return { ...eg, interests: eg.interests.map((i) => i.attendeeId === prev.currentAttendeeId ? { ...i, intensity } : i) };
          }
          return { ...eg, interests: [...eg.interests, { id: "temp", eventGameId, attendeeId: prev.currentAttendeeId!, intensity, notes: null, userName: "", userId: prev.currentUserId }] };
        }),
      };
    });
    await fetch(`/api/events/${eventId}/interests`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventGameId, intensity }),
    });
  };

  const handleRemoveInterest = async (eventGameId: string) => {
    // Optimistic: remove interest from UI
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        games: prev.games.map((eg) => {
          if (eg.id !== eventGameId) return eg;
          return { ...eg, interests: eg.interests.filter((i) => i.attendeeId !== prev.currentAttendeeId) };
        }),
      };
    });
    await fetch(`/api/events/${eventId}/interests`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventGameId }),
    });
  };

  const handleUpdateNotes = async (eventGameId: string, intensity: number, notes: string) => {
    // Optimistic: update notes locally
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        games: prev.games.map((eg) => {
          if (eg.id !== eventGameId) return eg;
          return { ...eg, interests: eg.interests.map((i) => i.attendeeId === prev.currentAttendeeId ? { ...i, notes } : i) };
        }),
      };
    });
    await fetch(`/api/events/${eventId}/interests`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventGameId, intensity, notes }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <Navbar />
        <p className="text-slate-400 text-center py-12 animate-pulse">Cargando evento...</p>
      </div>
    );
  }

  if (!event) return null;

  const isAttending = !!event.currentAttendeeId;

  // Games the current user has rated (for My List tab)
  const myInterests = event.games
    .map((eg) => {
      const myInterest = eg.interests.find((i) => i.attendeeId === event.currentAttendeeId);
      return myInterest ? { ...eg, myInterest } : null;
    })
    .filter(Boolean) as (EventGame & { myInterest: Interest })[];
  myInterests.sort((a, b) => b.myInterest.intensity - a.myInterest.intensity);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Navbar />
      <div className="max-w-3xl mx-auto py-4 sm:py-6 px-3 sm:px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">{event.name}</h1>
          {event.description && (
            <p className="text-slate-400 mt-1">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
              {formatDate(event.date)}
            </span>
            {event.location && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
                {event.location}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
              {event.attendees.filter((a) => a.status === "attending").length} asistente{event.attendees.filter((a) => a.status === "attending").length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-slate-500">
              Organiza: {event.createdBy.name || event.createdBy.email}
            </span>
          </div>

          {/* Join/Leave button */}
          <div className="mt-4">
            {isAttending ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-emerald-400 font-medium">Estás apuntado</span>
                {!event.isCreator && (
                  <button
                    onClick={handleLeave}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Desapuntarme
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joiningEvent}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {joiningEvent ? "Apuntándote..." : "Apuntarme"}
              </button>
            )}
          </div>

          {/* Invite link (creator only) */}
          {event.isCreator && (
            <div className="mt-4 bg-slate-800/50 rounded-lg border border-slate-700 p-3">
              <div className="text-xs font-medium text-slate-400 mb-2">Enlace de invitación</div>
              {inviteCode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/join-event/${inviteCode}`}
                    className="flex-1 min-w-0 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs sm:text-sm text-slate-300 truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join-event/${inviteCode}`);
                      setInviteCopied(true);
                      setTimeout(() => setInviteCopied(false), 2000);
                    }}
                    className="shrink-0 px-3 py-1.5 bg-amber-500 text-slate-900 rounded text-xs font-medium hover:bg-amber-600 transition-colors"
                  >
                    {inviteCopied ? "Copiado" : "Copiar"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setGeneratingLink(true);
                    try {
                      const res = await fetch(`/api/events/${eventId}/invite-link`, { method: "POST" });
                      if (res.ok) {
                        const data = await res.json();
                        setInviteCode(data.inviteCode);
                      }
                    } finally {
                      setGeneratingLink(false);
                    }
                  }}
                  disabled={generatingLink}
                  className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-xs font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  {generatingLink ? "Generando..." : "Generar enlace"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-slate-700 mb-4">
          {(["games", "mylist", "attendees"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "games" ? `Juegos (${event.games.length})` : tab === "mylist" ? `Mi Lista (${myInterests.length})` : `Asistentes (${event.attendees.length})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "games" && (
          <GamesTab
            event={event}
            onAddGame={handleAddGame}
            onRemoveGame={handleRemoveGame}
            onSetInterest={handleSetInterest}
            onRemoveInterest={handleRemoveInterest}
            addingGame={addingGame}
          />
        )}
        {activeTab === "mylist" && (
          <MyListTab
            myInterests={myInterests}
            event={event}
            onUpdateNotes={handleUpdateNotes}
            onRemoveInterest={handleRemoveInterest}
          />
        )}
        {activeTab === "attendees" && (
          <AttendeesTab event={event} />
        )}
      </div>
    </div>
  );
}

// ── Games Tab ─────────────────────────────────────────────────────────────

function GamesTab({
  event,
  onAddGame,
  onRemoveGame,
  onSetInterest,
  onRemoveInterest,
  addingGame,
}: {
  event: EventData;
  onAddGame: (game: { bggId: number }) => void;
  onRemoveGame: (gameId: string) => void;
  onSetInterest: (eventGameId: string, intensity: number) => void;
  onRemoveInterest: (eventGameId: string) => void;
  addingGame: boolean;
}) {
  const isAttending = !!event.currentAttendeeId;

  return (
    <div>
      {/* Search bar for creator */}
      {event.isCreator && (
        <div className="mb-4">
          <BggGameSearch
            onSelect={onAddGame}
            placeholder="Buscar juego en BGG para añadir..."
            disabled={addingGame}
          />
        </div>
      )}

      {event.games.length === 0 ? (
        <p className="text-slate-400 text-center py-8">
          {event.isCreator
            ? "Usa el buscador para añadir juegos al evento"
            : "El gestor aún no ha añadido juegos"}
        </p>
      ) : (
        <div className="space-y-3">
          {event.games.map((eg) => {
            const myInterest = eg.interests.find(
              (i) => i.attendeeId === event.currentAttendeeId
            );
            const totalInterested = eg.interests.length;

            return (
              <div
                key={eg.id}
                className="bg-slate-800 rounded-xl border border-slate-700 p-3 sm:p-4"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-[80px] sm:h-[80px] shrink-0 rounded-lg overflow-hidden bg-slate-700">
                    {eg.game.thumbnail ? (
                      <img src={eg.game.thumbnail} alt={eg.game.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-100 text-sm sm:text-base leading-tight">
                      <a
                        href={`https://boardgamegeek.com/boardgame/${eg.game.bggId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-amber-300 transition-colors"
                      >
                        {eg.game.name}
                      </a>
                      {eg.game.yearPublished && (
                        <span className="text-slate-500 font-normal ml-1 text-xs">({eg.game.yearPublished})</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {eg.game.bggRating && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                          ★ {eg.game.bggRating.toFixed(1)}
                        </span>
                      )}
                      {eg.game.playingTime && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                          {formatDuration(eg.game.playingTime)}
                        </span>
                      )}
                      {(eg.game.minPlayers || eg.game.maxPlayers) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                          {eg.game.minPlayers === eg.game.maxPlayers
                            ? `${eg.game.minPlayers}p`
                            : `${eg.game.minPlayers || "?"}-${eg.game.maxPlayers || "?"}p`}
                        </span>
                      )}
                      {totalInterested > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                          {totalInterested} interesado{totalInterested !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Remove button for creator */}
                  {event.isCreator && (
                    <button
                      onClick={() => onRemoveGame(eg.game.id)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-600 hover:text-red-400 hover:border-red-500/50 transition-colors text-sm"
                      title="Eliminar del evento"
                    >
                      🗑
                    </button>
                  )}
                </div>

                {/* Intensity picker for attending users */}
                {isAttending && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[5, 4, 3, 2, 1].map((level) => (
                      <button
                        key={level}
                        onClick={() =>
                          myInterest?.intensity === level
                            ? onRemoveInterest(eg.id)
                            : onSetInterest(eg.id, level)
                        }
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                          myInterest?.intensity === level
                            ? INTENSITY_COLORS[level]
                            : "border-slate-700 text-slate-500 hover:bg-slate-700"
                        }`}
                        title={INTENSITY_LABELS[level]}
                      >
                        <span className="sm:hidden">{level}</span>
                        <span className="hidden sm:inline">{level}. {INTENSITY_LABELS[level]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── My List Tab ───────────────────────────────────────────────────────────

function MyListTab({
  myInterests,
  event,
  onUpdateNotes,
  onRemoveInterest,
}: {
  myInterests: (EventGame & { myInterest: Interest })[];
  event: EventData;
  onUpdateNotes: (eventGameId: string, intensity: number, notes: string) => void;
  onRemoveInterest: (eventGameId: string) => void;
}) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  if (!event.currentAttendeeId) {
    return (
      <p className="text-slate-400 text-center py-8">
        Apúntate al evento para poder crear tu lista de juegos
      </p>
    );
  }

  if (myInterests.length === 0) {
    return (
      <p className="text-slate-400 text-center py-8">
        Aún no has marcado ningún juego. Ve a la pestaña &quot;Juegos&quot; y marca tus preferencias
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {myInterests.map(({ id: eventGameId, game, myInterest }) => (
        <div
          key={eventGameId}
          className="bg-slate-800 rounded-xl border border-slate-700 p-3 sm:p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-slate-700">
              {game.thumbnail ? (
                <img src={game.thumbnail} alt={game.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100 text-sm sm:text-base">{game.name}</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border mt-1 ${INTENSITY_COLORS[myInterest.intensity]}`}>
                {myInterest.intensity}. {INTENSITY_LABELS[myInterest.intensity]}
              </span>
            </div>
            <button
              onClick={() => onRemoveInterest(eventGameId)}
              className="shrink-0 text-slate-500 hover:text-red-400 text-xs transition-colors"
            >
              Quitar
            </button>
          </div>

          {/* Notes section */}
          <div className="mt-3">
            {editingNotes === eventGameId ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  maxLength={500}
                  placeholder="Notas privadas..."
                  className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onUpdateNotes(eventGameId, myInterest.intensity, notesValue);
                      setEditingNotes(null);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    onUpdateNotes(eventGameId, myInterest.intensity, notesValue);
                    setEditingNotes(null);
                  }}
                  className="px-3 py-1.5 bg-amber-500 text-slate-900 rounded text-xs font-medium hover:bg-amber-600 transition-colors"
                >
                  Guardar
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingNotes(eventGameId);
                  setNotesValue(myInterest.notes || "");
                }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {myInterest.notes ? `📝 ${myInterest.notes}` : "Añadir nota privada..."}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Attendees Tab ─────────────────────────────────────────────────────────

function AttendeesTab({ event }: { event: EventData }) {
  return (
    <div>
      {event.attendees.length === 0 ? (
        <p className="text-slate-400 text-center py-8">Nadie se ha apuntado todavía</p>
      ) : (
        <div className="space-y-3">
          {event.attendees.map((att) => {
            const isCreator = att.userId === event.createdById;
            // Collect this attendee's interests across all games
            const attendeeInterests = event.games
              .map((eg) => {
                const interest = eg.interests.find((i) => i.attendeeId === att.id);
                return interest ? { game: eg.game, interest } : null;
              })
              .filter(Boolean) as { game: Game; interest: Interest }[];
            attendeeInterests.sort((a, b) => b.interest.intensity - a.interest.intensity);

            return (
              <div
                key={att.id}
                className="bg-slate-800 rounded-xl border border-slate-700 p-3 sm:p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                    {(att.user.name || att.user.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-100 text-sm">
                      {att.user.name ? `${att.user.name}${att.user.surname ? ` ${att.user.surname}` : ""}` : att.user.email}
                    </div>
                    {isCreator && (
                      <span className="text-xs text-amber-400">Gestor</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    att.status === "attending"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : att.status === "maybe"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-slate-700 text-slate-400"
                  }`}>
                    {att.status === "attending" ? "Asiste" : att.status === "maybe" ? "Quizás" : "Cancelado"}
                  </span>
                </div>

                {/* Show attendee's interests (no notes — those are private) */}
                {attendeeInterests.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {attendeeInterests.map(({ game, interest }) => (
                      <span
                        key={interest.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${INTENSITY_COLORS[interest.intensity]}`}
                        title={`${INTENSITY_LABELS[interest.intensity]}`}
                      >
                        <span className="font-bold">{interest.intensity}</span>
                        <span className="max-w-[100px] sm:max-w-[150px] truncate">{game.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
