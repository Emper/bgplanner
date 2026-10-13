"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BggGameSearch from "@/components/BggGameSearch";
import BggRating from "@/components/BggRating";
import Avatar from "@/components/Avatar";
import ActivityFeed, { getCachedFeed, setCachedFeed } from "@/components/ActivityFeed";
import EventGallery from "@/components/EventGallery";
import EmojiField from "@/components/EmojiField";
import { formatDateFull, formatDuration } from "@/lib/format";
import { resizeImage } from "@/lib/image";
import { profileHref } from "@/lib/users";
import { INTENSITY_LABELS, INTENSITY_COLORS } from "@/lib/intensity";

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

interface Interest {
  id: string;
  eventGameId: string;
  attendeeId: string;
  intensity: number;
  notes: string | null;
  playedAt: string | null;
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
  role: string; // attendee | admin
  user: { id: string; name: string | null; displayName: string | null; surname: string | null; avatarUrl: string | null; bggUsername: string | null; slug: string | null };
}

interface EventData {
  id: string;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  location: string | null;
  maxAttendees: number | null;
  imageUrl: string | null;
  visibility: string;
  inviteCode: string | null;
  createdById: string;
  createdBy: { id: string; name: string | null; displayName: string | null };
  games: EventGame[];
  attendees: Attendee[];
  currentUserId: string;
  isCreator: boolean;
  isAdmin: boolean;
  currentAttendeeId: string | null;
}

type Tab = "activity" | "games" | "mylist" | "attendees" | "gallery";
const TABS: Tab[] = ["activity", "games", "mylist", "attendees", "gallery"];

const INVITE_OPEN_KEY = "event-invite-open";

const formatDate = formatDateFull;

function EventDetailPageInner() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab") as Tab | null;
    return tab && TABS.includes(tab) ? tab : "activity";
  });
  const [openReviewSignal, setOpenReviewSignal] = useState(0);
  const reviewDeepLinkHandled = useRef(false);
  const [addingGame, setAddingGame] = useState(false);
  const [joiningEvent, setJoiningEvent] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  // La caja del enlace de invitación va plegada salvo que la hayas abierto
  const [inviteOpen, setInviteOpen] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(INVITE_OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Activity feed state (restore from cache if available)
  const eventFeedCacheKey = `event:${eventId}`;
  const cachedEventFeed = getCachedFeed(eventFeedCacheKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [feedItems, setFeedItems] = useState<any[]>(cachedEventFeed?.items ?? []);
  const [feedCursor, setFeedCursor] = useState<string | null>(cachedEventFeed?.cursor ?? null);
  const [feedHasMore, setFeedHasMore] = useState(!!cachedEventFeed?.cursor);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoaded, setFeedLoaded] = useState(!!cachedEventFeed);

  // Edit event state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMaxAttendees, setEditMaxAttendees] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "private">("public");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchEventFeed = useCallback(async (cursor?: string) => {
    setFeedLoading(true);
    try {
      const url = `/api/events/${eventId}/feed?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setFeedItems((prev) => {
            const seen = new Set(prev.map((i: { id: string }) => i.id));
            const merged = [...prev, ...data.items.filter((i: { id: string }) => !seen.has(i.id))];
            setCachedFeed(`event:${eventId}`, merged, data.nextCursor);
            return merged;
          });
        } else {
          setFeedItems(data.items);
          setCachedFeed(`event:${eventId}`, data.items, data.nextCursor);
        }
        setFeedCursor(data.nextCursor);
        setFeedHasMore(!!data.nextCursor);
        setFeedLoaded(true);
      }
    } finally {
      setFeedLoading(false);
    }
  }, [eventId]);

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

  useEffect(() => {
    if (activeTab === "activity" && !feedLoaded) fetchEventFeed();
  }, [activeTab, feedLoaded, fetchEventFeed]);

  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    router.replace(`/events/${eventId}${tab !== "activity" ? `?tab=${tab}` : ""}`, { scroll: false });
    if (tab === "activity") fetchEventFeed();
  }, [router, eventId, fetchEventFeed]);

  const toggleInvite = () => {
    setInviteOpen((open) => {
      try {
        localStorage.setItem(INVITE_OPEN_KEY, open ? "0" : "1");
      } catch {
        // Sin almacenamiento (modo privado) simplemente no se recuerda
      }
      return !open;
    });
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join-event/${inviteCode}`);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  // Deep-link ?review=1 (desde el email de "valora el evento"): abre la galería
  // y hace scroll al formulario de valoración.
  useEffect(() => {
    if (reviewDeepLinkHandled.current || !event) return;
    if (searchParams.get("review")) {
      reviewDeepLinkHandled.current = true;
      setActiveTab("gallery");
      setOpenReviewSignal((n) => n + 1);
    }
  }, [event, searchParams]);

  const openEditModal = () => {
    if (!event) return;
    setEditName(event.name);
    setEditDescription(event.description || "");
    // Convert ISO date to datetime-local format
    setEditDate(event.date ? new Date(event.date).toISOString().slice(0, 16) : "");
    setEditEndDate(event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : "");
    setEditLocation(event.location || "");
    setEditMaxAttendees(event.maxAttendees ? String(event.maxAttendees) : "");
    setEditVisibility(event.visibility as "public" | "private");
    setEditImageUrl(event.imageUrl || null);
    setShowEdit(true);
  };

  const handleImageUpload = async (file: File, target: "edit" | "direct") => {
    if (!file.type.startsWith("image/")) return;
    setUploadingImage(true);
    try {
      const resized = await resizeImage(file, 600);
      if (target === "edit") {
        setEditImageUrl(resized);
      } else {
        // Direct upload (from header) — save immediately
        const res = await fetch(`/api/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: resized }),
        });
        if (res.ok) {
          setEvent((prev) => prev ? { ...prev, imageUrl: resized } : prev);
        }
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          date: editDate ? new Date(editDate).toISOString() : undefined,
          endDate: editEndDate ? new Date(editEndDate).toISOString() : null,
          location: editLocation || null,
          maxAttendees: editMaxAttendees ? parseInt(editMaxAttendees) : null,
          visibility: editVisibility,
          imageUrl: editImageUrl,
        }),
      });
      if (res.ok) {
        setShowEdit(false);
        fetchEvent();
      } else {
        const data = await res.json();
        alert(data.error || "Error al guardar");
      }
    } finally {
      setSavingEdit(false);
    }
  };

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
          return { ...eg, interests: [...eg.interests, { id: "temp", eventGameId, attendeeId: prev.currentAttendeeId!, intensity, notes: null, playedAt: null, userName: "", userId: prev.currentUserId }] };
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

  const handleSetAttendeeRole = async (attendeeId: string, role: "attendee" | "admin") => {
    const res = await fetch(`/api/events/${eventId}/attendees/${attendeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al cambiar el rol");
      return;
    }
    setEvent((prev) => prev && {
      ...prev,
      attendees: prev.attendees.map((a) => (a.id === attendeeId ? { ...a, role } : a)),
    });
  };

  const handleTogglePlayed = async (eventGameId: string, intensity: number, played: boolean) => {
    const playedAt = played ? new Date().toISOString() : null;
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        games: prev.games.map((eg) => {
          if (eg.id !== eventGameId) return eg;
          return { ...eg, interests: eg.interests.map((i) => i.attendeeId === prev.currentAttendeeId ? { ...i, playedAt } : i) };
        }),
      };
    });
    await fetch(`/api/events/${eventId}/interests`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventGameId, intensity, played }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <Navbar />
        <p className="text-[var(--text-secondary)] text-center py-12 animate-pulse">Cargando evento...</p>
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
  const attendingCount = event.attendees.filter((a) => a.status === "attending").length;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Navbar />
      <div className="max-w-3xl mx-auto py-4 sm:py-6 px-3 sm:px-4">
        {/* Event image */}
        {(event.imageUrl || event.isAdmin) && (
          <div className="mb-4 relative group">
            {event.imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-[var(--border)]">
                <Image
                  src={event.imageUrl}
                  alt={event.name}
                  width={1200}
                  height={400}
                  unoptimized
                  className="w-full h-40 sm:h-52 object-cover"
                />
                {event.isAdmin && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-xl">
                      {uploadingImage ? "Subiendo..." : "Cambiar imagen"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, "direct");
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            ) : event.isAdmin ? (
              <label className="flex items-center justify-center h-32 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--surface)] cursor-pointer transition-all duration-200">
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <span className="text-xs text-[var(--text-muted)]">
                    {uploadingImage ? "Subiendo..." : "Añadir imagen del evento"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f, "direct");
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">{event.name}</h1>
            {event.isAdmin && (
              <button
                onClick={openEditModal}
                className="shrink-0 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] border border-[var(--border)] hover:border-[var(--primary)]/30 hover:shadow-[var(--card-shadow-hover)] rounded-xl transition-all duration-200"
              >
                Editar
              </button>
            )}
          </div>
          {event.description && (
            <p className="text-[var(--text-secondary)] mt-1">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-[var(--accent-soft)] text-[var(--primary)]">
              {formatDate(event.date)}
            </span>
            {event.location && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                {event.location}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
              {attendingCount} asistente{attendingCount !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              Organiza: {event.createdBy.displayName || event.createdBy.name || "Alguien"}
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
                    className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    Desapuntarme
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joiningEvent}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold px-5 py-2 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
              >
                {joiningEvent ? "Apuntándote..." : "Apuntarme"}
              </button>
            )}
          </div>

          {/* Invite link (creator only) */}
          {event.isAdmin && (
            <div className="mt-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleInvite}
                  aria-expanded={inviteOpen}
                  className="flex-1 flex items-center gap-1.5 text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors py-1"
                >
                  <span className={`inline-block text-[10px] transition-transform duration-200 ${inviteOpen ? "rotate-90" : ""}`}>▶</span>
                  Enlace de invitación
                </button>
                {inviteCode && !inviteOpen && (
                  <button
                    onClick={copyInvite}
                    className="shrink-0 px-3 py-1 bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-xl text-xs font-medium hover:text-[var(--primary)] transition-all duration-200"
                  >
                    {inviteCopied ? "Copiado" : "Copiar"}
                  </button>
                )}
              </div>
              {inviteOpen && (
                <div className="mt-1.5 mb-1">
                  {inviteCode ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/join-event/${inviteCode}`}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 min-w-0 px-2 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs sm:text-sm text-[var(--text-secondary)] truncate transition-all duration-200"
                      />
                      <button
                        onClick={copyInvite}
                        className="shrink-0 px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-xs font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-sm hover:shadow-md"
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
                      className="px-3 py-1.5 bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-xl text-xs font-medium hover:text-[var(--text)] transition-all duration-200 disabled:opacity-50"
                    >
                      {generatingLink ? "Generando..." : "Generar enlace"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-[var(--border)] mb-4 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`pb-2 text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
                activeTab === tab
                  ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
              }`}
            >
              {tab === "activity" ? "Actividad" : tab === "games" ? `Juegos (${event.games.length})` : tab === "mylist" ? `Mi Lista (${myInterests.length})` : tab === "attendees" ? `Asistentes (${event.attendees.length})` : "Galería"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "activity" && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4">
            <ActivityFeed
              items={feedItems}
              onLoadMore={() => feedCursor && fetchEventFeed(feedCursor)}
              hasMore={feedHasMore}
              loading={feedLoading}
            />
          </div>
        )}
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
            onTogglePlayed={handleTogglePlayed}
          />
        )}
        {activeTab === "attendees" && (
          <AttendeesTab event={event} onSetRole={handleSetAttendeeRole} />
        )}
        {activeTab === "gallery" && (
          <EventGallery
            eventId={eventId}
            currentUserId={event.currentUserId}
            canParticipate={event.isCreator || event.currentAttendeeId != null}
            isAdmin={event.isAdmin}
            openReviewSignal={openReviewSignal}
          />
        )}
      </div>

      {/* Edit event modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Editar evento</h3>
              <button onClick={() => setShowEdit(false)} className="text-[var(--text-secondary)] hover:text-[var(--text)]">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Nombre del evento *</label>
                <EmojiField multiline={false} value={editName} onChange={setEditName}
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200" maxLength={200} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Descripción</label>
                <EmojiField value={editDescription} onChange={setEditDescription} rows={3}
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none resize-none transition-all duration-200" maxLength={2000} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Fecha y hora *</label>
                  <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Fecha fin (opcional)</label>
                  <input type="datetime-local" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Ubicación</label>
                  <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200" maxLength={300} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Máx. asistentes</label>
                  <input type="number" value={editMaxAttendees} onChange={(e) => setEditMaxAttendees(e.target.value)} min={1}
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Imagen del evento</label>
                <div className="flex items-center gap-3">
                  {editImageUrl ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
                      <Image src={editImageUrl} alt="Preview" width={80} height={80} unoptimized className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-xs shrink-0">
                      Sin imagen
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="px-3 py-1.5 bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-xl text-xs font-medium hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-all duration-200 cursor-pointer text-center">
                      {uploadingImage ? "Subiendo..." : editImageUrl ? "Cambiar" : "Subir imagen"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f, "edit");
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {editImageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditImageUrl(null)}
                        className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Visibilidad</label>
                <div className="flex gap-2">
                  {(["public", "private"] as const).map((v) => (
                    <button key={v} onClick={() => setEditVisibility(v)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        editVisibility === v ? "bg-[var(--primary)] text-[var(--primary-text)]" : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {v === "public" ? "Público" : "Privado"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={handleSaveEdit} disabled={savingEdit || !editName.trim() || !editDate}
              className="w-full mt-5 px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// La ficha completa del evento, solo para quien ha iniciado sesión: la sirve
// page.tsx, que a quien llega sin cuenta le enseña la versión pública.
export default function EventClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <EventDetailPageInner />
    </Suspense>
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
      {event.isAdmin && (
        <div className="mb-4">
          <BggGameSearch
            onSelect={onAddGame}
            placeholder="Buscar juego en BGG para añadir..."
            disabled={addingGame}
          />
        </div>
      )}

      {event.games.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-8">
          {event.isAdmin
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
                className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-3 sm:p-4 transition-all duration-200"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-[80px] sm:h-[80px] shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)]">
                    {eg.game.thumbnail ? (
                      <Image src={eg.game.thumbnail} alt={eg.game.name} width={80} height={80} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--text)] text-sm sm:text-base leading-tight">
                      <a
                        href={`https://boardgamegeek.com/boardgame/${eg.game.bggId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[var(--primary)] transition-colors"
                      >
                        {eg.game.name}
                      </a>
                      {eg.game.yearPublished && (
                        <span className="text-[var(--text-muted)] font-normal ml-1 text-xs">({eg.game.yearPublished})</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {eg.game.bggRating && (
                        <BggRating rating={eg.game.bggRating} size={30} />
                      )}
                      {eg.game.bggRank && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300" title="Puesto en el ranking global de BGG">
                          🏆 BGG #{eg.game.bggRank.toLocaleString("es-ES")}
                        </span>
                      )}
                      {eg.game.playingTime && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                          {formatDuration(eg.game.playingTime)}
                        </span>
                      )}
                      {(eg.game.minPlayers || eg.game.maxPlayers) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]">
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
                  {event.isAdmin && (
                    <button
                      onClick={() => onRemoveGame(eg.game.id)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/50 transition-colors text-sm"
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
                            : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
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
  onTogglePlayed,
}: {
  myInterests: (EventGame & { myInterest: Interest })[];
  event: EventData;
  onUpdateNotes: (eventGameId: string, intensity: number, notes: string) => void;
  onTogglePlayed: (eventGameId: string, intensity: number, played: boolean) => void;
}) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };

  if (!event.currentAttendeeId) {
    return (
      <p className="text-[var(--text-secondary)] text-center py-8">
        Apúntate al evento para poder crear tu lista de juegos
      </p>
    );
  }

  if (myInterests.length === 0) {
    return (
      <p className="text-[var(--text-secondary)] text-center py-8">
        Aún no has marcado ningún juego. Ve a la pestaña &quot;Juegos&quot; y marca tus preferencias
      </p>
    );
  }

  const pending = myInterests.filter((i) => !i.myInterest.playedAt);
  // Los jugados, en el orden en que se marcaron
  const played = myInterests
    .filter((i) => i.myInterest.playedAt)
    .sort((a, b) => a.myInterest.playedAt!.localeCompare(b.myInterest.playedAt!));

  const saveNotes = (eventGameId: string, intensity: number) => {
    onUpdateNotes(eventGameId, intensity, notesValue);
    setEditingNotes(null);
  };

  const renderRow = ({ id: eventGameId, game, myInterest }: EventGame & { myInterest: Interest }, isPlayed: boolean) => (
    <li key={eventGameId} className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={isPlayed}
        aria-label={isPlayed ? `Desmarcar ${game.name} como jugado` : `Marcar ${game.name} como jugado`}
        title={isPlayed ? "Desmarcar" : "Marcar como jugado"}
        onClick={() => onTogglePlayed(eventGameId, myInterest.intensity, !isPlayed)}
        className={`w-7 h-7 mt-1.5 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all duration-200 active:scale-90 ${
          isPlayed
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-[var(--border-strong)] bg-[var(--input-bg)] text-transparent hover:border-emerald-400 hover:text-emerald-400/50"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </button>
      <div className={`w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)] ${isPlayed ? "opacity-60" : ""}`}>
        {game.thumbnail ? (
          <Image src={game.thumbnail} alt={game.name} width={40} height={40} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">?</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
          <span className={`font-semibold text-sm sm:text-base ${isPlayed ? "text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]" : "text-[var(--text)]"}`}>
            {game.name}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium border ${INTENSITY_COLORS[myInterest.intensity]} ${isPlayed ? "opacity-60" : ""}`}
            title={INTENSITY_LABELS[myInterest.intensity]}
          >
            <span className="sm:hidden">{myInterest.intensity}</span>
            <span className="hidden sm:inline">{myInterest.intensity}. {INTENSITY_LABELS[myInterest.intensity]}</span>
          </span>
        </div>

        {editingNotes === eventGameId ? (
          <div className="flex gap-2 mt-1.5">
            <EmojiField
              multiline={false}
              value={notesValue}
              onChange={setNotesValue}
              maxLength={500}
              placeholder="Notas privadas..."
              wrapperClassName="flex-1"
              className="w-full px-2 py-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNotes(eventGameId, myInterest.intensity);
              }}
            />
            <button
              onClick={() => saveNotes(eventGameId, myInterest.intensity)}
              className="px-3 py-1 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-xs font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-sm hover:shadow-md"
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
            className={`block text-left text-xs mt-0.5 transition-colors ${
              myInterest.notes
                ? "text-[var(--text-secondary)] hover:text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {myInterest.notes ? `📝 ${myInterest.notes}` : "Añadir nota privada..."}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-[var(--text-muted)]">Tus notas son privadas: solo las ves tú.</p>
        <button
          onClick={() => setShareOpen(true)}
          title="Compartir mi lista"
          className="shrink-0 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 transition-all duration-200"
        >
          ↗ Compartir
        </button>
      </div>

      {pending.length > 0 ? (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] px-3 sm:px-4 py-1">
          <ul className="divide-y divide-[var(--border)]">
            {pending.map((item) => renderRow(item, false))}
          </ul>
        </div>
      ) : (
        <p className="text-[var(--text-secondary)] text-center py-6">¡Ya has jugado todo lo de tu lista! 🎉</p>
      )}

      {played.length > 0 && (
        <div className="mt-6 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] px-3 sm:px-4 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pt-1.5">
            Jugados ({played.length})
          </h3>
          <ul className="divide-y divide-[var(--border)]">
            {played.map((item) => renderRow(item, true))}
          </ul>
        </div>
      )}

      {shareOpen && (
        <ShareListModal eventId={event.id} onClose={() => setShareOpen(false)} onToast={showToast} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-lg text-sm text-[var(--text)] max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Compartir Mi Lista ────────────────────────────────────────────────────

function ShareListModal({
  eventId,
  onClose,
  onToast,
}: {
  eventId: string;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const endpoint = `/api/events/${eventId}/my-list/share`;

  useEffect(() => {
    fetch(endpoint)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setToken(data?.token ?? null))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [endpoint]);

  const call = async (method: "POST" | "DELETE") => {
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token ?? null);
      setConfirmRevoke(false);
      onToast(method === "DELETE" ? "Enlace desactivado: ya no se puede abrir" : "Enlace listo para compartir");
    } catch {
      onToast("No se ha podido cambiar el enlace");
    } finally {
      setBusy(false);
    }
  };

  const url = token ? `${window.location.origin}/l/${token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onToast("Enlace copiado");
    } catch {
      onToast("No se ha podido copiar; selecciónalo a mano");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-[var(--text)]">Compartir mi lista</h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="h-24 flex items-center justify-center">
              <span className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
            </div>
          ) : token ? (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                <strong>Cualquiera con este enlace</strong> puede ver tu lista para este evento: tus prioridades y lo que
                ya has jugado, siempre al día. Tus notas no salen. No hace falta cuenta y no se puede cambiar nada.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text)] font-mono"
                />
                <button
                  onClick={copy}
                  className="shrink-0 px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-200"
                >
                  Copiar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                <button
                  onClick={() => call("POST")}
                  disabled={busy}
                  className="px-3 py-1.5 bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-lg text-xs hover:text-[var(--text)] disabled:opacity-50 transition-colors"
                  title="Genera un enlace nuevo; el anterior deja de funcionar"
                >
                  Generar uno nuevo
                </button>
                {confirmRevoke ? (
                  <button
                    onClick={() => call("DELETE")}
                    disabled={busy}
                    className="px-3 py-1.5 bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    ¿Seguro? Dejar de compartir
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmRevoke(true)}
                    className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                  >
                    Dejar de compartir
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Genera un enlace para que quien te acompañe vea qué te apetece jugar en este evento y qué has jugado
                ya. Solo pueden mirar, y tus notas no salen. Lo abre cualquiera que lo tenga, sin cuenta, así que
                desactívalo cuando ya no haga falta.
              </p>
              <button
                onClick={() => call("POST")}
                disabled={busy}
                className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-all duration-200"
              >
                {busy ? "Creando…" : "Crear enlace para compartir"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Attendees Tab ─────────────────────────────────────────────────────────

function AttendeesTab({
  event,
  onSetRole,
}: {
  event: EventData;
  onSetRole: (attendeeId: string, role: "attendee" | "admin") => void;
}) {
  return (
    <div>
      {event.attendees.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-8">Nadie se ha apuntado todavía</p>
      ) : (
        <div className="space-y-3">
          {event.attendees.map((att) => {
            const isCreator = att.userId === event.createdById;
            const isAdmin = !isCreator && att.role === "admin";
            const isSelf = att.userId === event.currentUserId;
            const displayName = att.user.displayName || att.user.name || "Jugador";
            // Como en grupos: los admins nombran admins; quitarlos, solo el creador
            const canPromote = event.isAdmin && !isCreator && !isAdmin && !isSelf;
            const canDemote = event.isCreator && isAdmin;
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
                className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-3 sm:p-4 transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <Link href={profileHref(att.user)} prefetch={false}>
                    <Avatar
                      name={displayName}
                      avatarUrl={att.user.avatarUrl}
                      size="sm"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--text)] text-sm">
                      <Link
                        href={profileHref(att.user)}
                        prefetch={false}
                        className="hover:text-[var(--primary)] transition-colors"
                      >
                        {att.user.name ? `${att.user.name}${att.user.surname ? ` ${att.user.surname}` : ""}` : att.user.displayName || "Jugador"}
                      </Link>
                      {att.user.bggUsername && (
                        <a
                          href={`https://boardgamegeek.com/user/${att.user.bggUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors ml-1.5 font-normal"
                        >
                          @{att.user.bggUsername}
                        </a>
                      )}
                    </div>
                    {isCreator && (
                      <span className="text-xs text-[var(--primary)]">Gestor</span>
                    )}
                    {isAdmin && (
                      <span className="text-xs text-[var(--primary)]">Admin</span>
                    )}
                  </div>
                  {canPromote && (
                    <button
                      onClick={() => {
                        if (confirm(`¿Hacer admin a ${displayName}? Podrá editar el evento, gestionar los juegos y el enlace de invitación.`)) {
                          onSetRole(att.id, "admin");
                        }
                      }}
                      className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-soft)] text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
                    >
                      Hacer admin
                    </button>
                  )}
                  {canDemote && (
                    <button
                      onClick={() => {
                        if (confirm(`¿Quitar admin a ${displayName}?`)) onSetRole(att.id, "attendee");
                      }}
                      className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Quitar admin
                    </button>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    att.status === "attending"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : att.status === "maybe"
                        ? "bg-[var(--accent-soft)] text-[var(--primary)]"
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)]"
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
      <Footer />
    </div>
  );
}
