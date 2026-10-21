"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import BggGameSearch from "@/components/BggGameSearch";
import BggRating from "@/components/BggRating";
import GameTags, { GameTag } from "@/components/GameTags";
import Avatar from "@/components/Avatar";
import ActivityFeed, { getCachedFeed, setCachedFeed } from "@/components/ActivityFeed";
import EmojiField from "@/components/EmojiField";
import dynamic from "next/dynamic";
import RichText from "@/components/RichText";
import { formatDateFull, toDateTimeLocalInput } from "@/lib/format";
import { EVENT_ABOUT_MAX, joinNames, plural } from "@/lib/text";
import { resizeImage } from "@/lib/image";
import { displayName, profileHref } from "@/lib/users";
import { bggGameUrl, bggUserUrl } from "@/lib/bggLinks";
import { writeStorage } from "@/lib/storage";
import { useStoredValue } from "@/hooks/useStoredValue";
import { shareUrl } from "@/lib/site";
import { copyText } from "@/lib/clipboard";
import { useCopy } from "@/hooks/useCopy";
import PageShell from "@/components/ui/PageShell";
import { BackLink } from "@/components/ui/PageHeader";
import Button, { ButtonLink, buttonClass } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Field, Input, LABEL_CLASS, fieldClass } from "@/components/ui/Field";
import { SegmentedControl, Tabs } from "@/components/ui/Tabs";
import { EmptyState, Notice } from "@/components/ui/EmptyState";
import { cardClass } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import GameThumb from "@/components/ui/GameThumb";
import { toFriend } from "@/lib/friends";
import FriendButton from "@/components/FriendButton";
import { INTENSITY_LABELS, INTENSITY_COLORS, INTENSITY_LEVELS, isVeto, intensityMark, intensityText } from "@/lib/intensity";
import { nudgePush } from "@/lib/pushNudge";
import GeeklistPanel, { GeeklistNotice } from "./GeeklistPanel";
import GameManualLinks from "@/components/GameManualLinks";

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
  manualUrl: string | null;
  manualAddedById: string | null;
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
  fromGeeklist: boolean;
  /** Ha salido de la lista de BGG pero se queda porque tenía intereses */
  leftGeeklistAt: string | null;
}

interface Attendee {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  role: string; // attendee | admin
  user: { id: string; name: string | null; displayName: string | null; surname: string | null; avatarUrl: string | null; bggUsername: string | null; slug: string | null };
}

export interface EventData {
  id: string;
  name: string;
  description: string | null;
  about: string | null;
  date: string;
  endDate: string | null;
  location: string | null;
  maxAttendees: number | null;
  imageUrl: string | null;
  visibility: string;
  inviteCode: string | null;
  createdById: string;
  createdBy: { id: string; name: string | null; displayName: string | null };
  bggGeeklistId: number | null;
  geeklistTitle: string | null;
  geeklistSyncedAt: string | null;
  geeklistError: string | null;
  games: EventGame[];
  attendees: Attendee[];
  currentUserId: string;
  isCreator: boolean;
  isAdmin: boolean;
  currentAttendeeId: string | null;
}

// La galería y "Armar mesa" solo se abren a petición: su código se descarga
// entonces, no con la ficha del evento.
const EventGallery = dynamic(() => import("@/components/EventGallery"));
const MesaView = dynamic(() => import("./MesaView"));

type Tab = "info" | "activity" | "games" | "mylist" | "attendees" | "gallery";
const TABS: Tab[] = ["info", "activity", "games", "mylist", "attendees", "gallery"];

const INVITE_OPEN_KEY = "event-invite-open";

// Los que han salido de la lista de BGG solo se ven, recogidos, en la
// pestaña Juegos: ni en Mi Lista, ni en los asistentes, ni al armar mesa
function listedGames(event: EventData): EventGame[] {
  return event.bggGeeklistId ? event.games.filter((eg) => !eg.leftGeeklistAt) : event.games;
}

const formatDate = formatDateFull;

// Enlace a /community con un hilo de «Buscar partida» ya redactado.
function communityAnnounceHref(event: EventData): string {
  const when = formatDateFull(event.date);
  const lines = [
    `¡Hola! Organizamos «${event.name}» el ${when}${event.location ? ` en ${event.location}` : ""} y buscamos más gente para jugar.`,
    event.description?.trim() || "",
    `Toda la info y para apuntarse: ${shareUrl(`/events/${event.id}`)}`,
  ].filter(Boolean);
  const params = new URLSearchParams({
    nuevo: "1",
    tag: "buscar-partida",
    titulo: `Buscamos jugadores para «${event.name.slice(0, 100)}»`,
    texto: lines.join("\n\n"),
  });
  return `/community?${params.toString()}`;
}

/** Una página del feed tal y como la devuelve /api/events/[id]/feed. */
export interface EventFeedPage {
  items: Parameters<typeof setCachedFeed>[1];
  nextCursor: string | null;
}

/**
 * Lo que trae pintado el servidor (page.tsx). `initial` es el evento con la
 * misma forma que GET /api/events/[id]; `initialError`, que no existe o no
 * puedes verlo. Sin nada de esto, el cliente lo pide como siempre.
 */
interface EventClientProps {
  initial?: EventData;
  initialFeed?: EventFeedPage;
  initialError?: string;
}

function EventDetailPageInner({ initial, initialFeed, initialError }: EventClientProps) {
  const { id: eventId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<EventData | null>(initial ?? null);
  // Con datos del servidor (o su «no existe») no hay carga de arranque
  const fromServer = !!initial || !!initialError;
  const [loading, setLoading] = useState(!fromServer);
  const toast = useToast();
  const confirm = useConfirm();
  const { copied: inviteCopied, copy } = useCopy();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab") as Tab | null;
    return tab && TABS.includes(tab) ? tab : "activity";
  });
  const [openReviewSignal, setOpenReviewSignal] = useState(0);
  // Para saber si el evento ya ha terminado. Se fija al abrir la página.
  const [now] = useState(() => Date.now());
  const [addingGame, setAddingGame] = useState(false);
  const [joiningEvent, setJoiningEvent] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(initial?.inviteCode ?? null);
  const [generatingLink, setGeneratingLink] = useState(false);
  // La caja del enlace de invitación va plegada salvo que la hayas abierto
  const storedInviteOpen = useStoredValue(INVITE_OPEN_KEY);
  const [chosenInviteOpen, setInviteOpen] = useState<boolean | null>(null);
  const inviteOpen = chosenInviteOpen ?? storedInviteOpen === "1";

  // Activity feed state: la primera página del servidor, o la caché si la hay
  const eventFeedCacheKey = `event:${eventId}`;
  const [cachedEventFeed] = useState(() =>
    initialFeed
      ? { items: initialFeed.items, cursor: initialFeed.nextCursor }
      : getCachedFeed(eventFeedCacheKey)
  );
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
  const [editAbout, setEditAbout] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMaxAttendees, setEditMaxAttendees] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "private">("public");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Quien pide más páginas o recarga marca antes `feedLoading`; la primera
  // carga no hace falta, porque sin feed cargado ya se pinta como cargando.
  const fetchEventFeed = useCallback((cursor?: string) => {
    const url = `/api/events/${eventId}/feed?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    return fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
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
      })
      .catch(() => {})
      .finally(() => {
        setFeedLoading(false);
        setFeedLoaded(true);
      });
  }, [eventId]);

  const fetchEvent = useCallback(
    () =>
      fetch(`/api/events/${eventId}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data) => {
          setEvent(data);
          if (data.inviteCode) setInviteCode(data.inviteCode);
        })
        // Si no existe o no tienes acceso, `event` se queda vacío y se avisa
        .catch(() => {})
        .finally(() => setLoading(false)),
    [eventId]
  );

  useEffect(() => {
    if (!fromServer) fetchEvent();
  }, [fetchEvent, fromServer]);

  // Lo que llega del servidor se siembra en la caché, como si se hubiera pedido
  useEffect(() => {
    if (initialFeed) setCachedFeed(`event:${eventId}`, initialFeed.items, initialFeed.nextCursor);
  }, [initialFeed, eventId]);

  useEffect(() => {
    if (activeTab === "activity" && !feedLoaded) fetchEventFeed();
  }, [activeTab, feedLoaded, fetchEventFeed]);

  const loadMoreFeed = () => {
    if (!feedCursor) return;
    setFeedLoading(true);
    fetchEventFeed(feedCursor);
  };

  // "Armar mesa" (pestaña Asistentes): ids de asistente, en la URL para
  // poder pasar el enlace a quien se sienta contigo
  const [mesa, setMesa] = useState<string[] | null>(() => {
    const ids = searchParams.get("mesa")?.split(",").filter(Boolean);
    return ids && ids.length > 0 ? ids : null;
  });

  // La pestaña y la mesa van en la URL con history y no con el router: el
  // router volvería a pintar la página en el servidor (y a pedir todo el
  // evento) en cada cambio de pestaña. Next mantiene useSearchParams al día.
  const replaceUrl = useCallback((query: string) => {
    window.history.replaceState(null, "", `/events/${eventId}${query}`);
  }, [eventId]);

  const openMesa = useCallback((ids: string[]) => {
    setMesa(ids);
    setActiveTab("attendees");
    replaceUrl(`?tab=attendees&mesa=${ids.join(",")}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [replaceUrl]);

  const closeMesa = useCallback(() => {
    setMesa(null);
    replaceUrl("?tab=attendees");
  }, [replaceUrl]);

  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setMesa(null);
    replaceUrl(tab !== "activity" ? `?tab=${tab}` : "");
    // La primera vez lo carga el efecto de arriba; aquí solo se refresca.
    if (tab === "activity" && feedLoaded) {
      setFeedLoading(true);
      fetchEventFeed();
    }
  }, [replaceUrl, feedLoaded, fetchEventFeed]);

  const toggleInvite = () => {
    const next = !inviteOpen;
    // Sin almacenamiento (modo privado) simplemente no se recuerda
    writeStorage(INVITE_OPEN_KEY, next ? "1" : "0");
    setInviteOpen(next);
  };

  const copyInvite = async () => {
    if (!(await copy(shareUrl(`/join-event/${inviteCode}`)))) {
      toast.error("No se ha podido copiar el enlace");
    }
  };

  const generateInviteLink = async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invite-link`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setInviteCode(data.inviteCode);
      } else {
        toast.error("No se ha podido generar el enlace");
      }
    } catch {
      toast.error("No se ha podido generar el enlace");
    } finally {
      setGeneratingLink(false);
    }
  };

  // Con info general y sin pestaña en el enlace, se entra por la info: es lo
  // primero que quiere ver quien llega (horarios, cómo llegar…). Sin info, la
  // pestaña solo existe para quien puede rellenarla.
  // Se decide una sola vez, en el render en que llega el evento.
  const [defaultTabResolved, setDefaultTabResolved] = useState(false);
  if (event && !defaultTabResolved) {
    setDefaultTabResolved(true);
    const hasAbout = !!event.about?.trim();
    if (!searchParams.get("tab") && !searchParams.get("review") && hasAbout) {
      setActiveTab("info");
    } else if (searchParams.get("tab") === "info" && !hasAbout && !event.isAdmin) {
      setActiveTab("activity");
    }
  }

  // Deep-link ?review=1 (desde el email de "valora el evento"): abre la galería
  // y hace scroll al formulario de valoración.
  const [reviewDeepLinkHandled, setReviewDeepLinkHandled] = useState(false);
  if (event && !reviewDeepLinkHandled && searchParams.get("review")) {
    setReviewDeepLinkHandled(true);
    setActiveTab("gallery");
    setOpenReviewSignal((n) => n + 1);
  }

  const openEditModal = () => {
    if (!event) return;
    setEditName(event.name);
    setEditDescription(event.description || "");
    setEditAbout(event.about || "");
    setEditDate(toDateTimeLocalInput(event.date));
    setEditEndDate(toDateTimeLocalInput(event.endDate));
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
          about: editAbout.trim() ? editAbout : null,
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
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
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
    const ok = await confirm({ title: "¿Eliminar este juego del evento?", confirmLabel: "Eliminar", tone: "danger" });
    if (!ok) return;
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
        nudgePush("event");
      }
    } finally {
      setJoiningEvent(false);
    }
  };

  const handleLeave = async () => {
    const ok = await confirm({ title: "¿Desapuntarte del evento?", confirmLabel: "Desapuntarme", tone: "danger" });
    if (!ok) return;
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

  // El manual es del juego: se actualiza donde salga ese juego
  const handleManualChanged = (gameId: string, manual: { manualUrl: string | null; manualAddedById: string | null }) => {
    setEvent((prev) => prev ? {
      ...prev,
      games: prev.games.map((eg) => eg.game.id === gameId ? { ...eg, game: { ...eg.game, ...manual } } : eg),
    } : prev);
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
      toast.error(data.error || "Error al cambiar el rol");
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

  if (loading) return <EventLoading />;

  if (!event) {
    return (
      <PageShell nav={<Navbar />} width="form">
        <Notice
          icon="🔒"
          title="Este evento no existe o es privado"
          actions={<ButtonLink href="/events">Ir a mis eventos</ButtonLink>}
        >
          <p>Puede que lo hayan borrado, que el enlace esté mal copiado o que solo puedan verlo quienes están invitados.</p>
        </Notice>
      </PageShell>
    );
  }

  const isAttending = !!event.currentAttendeeId;
  const eventIsOver = new Date(event.endDate ?? event.date).getTime() < now;

  // Games the current user has rated (for My List tab)
  const myInterests = listedGames(event)
    .map((eg) => {
      const myInterest = eg.interests.find((i) => i.attendeeId === event.currentAttendeeId);
      return myInterest ? { ...eg, myInterest } : null;
    })
    .filter(Boolean) as (EventGame & { myInterest: Interest })[];
  myInterests.sort((a, b) => b.myInterest.intensity - a.myInterest.intensity);
  const attendingCount = event.attendees.filter((a) => a.status === "attending").length;

  const visibleTabs = TABS.filter((tab) => tab !== "info" || !!event.about?.trim() || event.isAdmin);
  const tabLabel = (tab: Tab) =>
    tab === "info" ? "Info general" : tab === "activity" ? "Actividad" : tab === "games" ? "Juegos" : tab === "mylist" ? "Mi Lista" : tab === "attendees" ? "Asistentes" : "Galería";
  const tabCount = (tab: Tab) =>
    tab === "games"
      ? listedGames(event).length
      : tab === "mylist"
        ? myInterests.filter((i) => !isVeto(i.myInterest.intensity)).length
        : tab === "attendees"
          ? event.attendees.length
          : undefined;

  return (
    <PageShell nav={<Navbar />} width="main">
      <BackLink href="/events" className="mb-3">Eventos</BackLink>

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
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-xl">
                    {uploadingImage ? "Subiendo…" : "Cambiar imagen"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
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
                <svg className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                <span className="text-xs text-[var(--text-muted)]">
                  {uploadingImage ? "Subiendo…" : "Añadir imagen del evento"}
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
          <h1 className="page-title">{event.name}</h1>
          {event.isAdmin && (
            <Button variant="secondary" size="xs" onClick={openEditModal} className="shrink-0">
              Editar
            </Button>
          )}
        </div>
        {event.description && (
          <p className="page-lead mt-1">{event.description}</p>
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
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-300">
            {plural(attendingCount, "asistente", "asistentes")}
          </span>
        </div>

        {/* Join/Leave button */}
        <div className="mt-4">
          {isAttending ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--success)] font-medium">Estás apuntado</span>
              {!event.isAdmin && (
                <button
                  onClick={handleLeave}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                >
                  Desapuntarme
                </button>
              )}
            </div>
          ) : (
            <Button onClick={handleJoin} loading={joiningEvent}>
              {joiningEvent ? "Apuntándote…" : "Apuntarme"}
            </Button>
          )}
        </div>

        {/* Invite link (creator only) */}
        {event.isAdmin && (
          <div className={cardClass({ padding: "none", className: "mt-4 px-3 py-2" })}>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleInvite}
                aria-expanded={inviteOpen}
                className="flex-1 flex items-center gap-1.5 text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors py-1"
              >
                <span aria-hidden className={`inline-block text-[10px] transition-transform duration-200 ${inviteOpen ? "rotate-90" : ""}`}>▶</span>
                Enlace de invitación
              </button>
              {inviteCode && !inviteOpen && (
                <Button variant="secondary" size="xs" onClick={copyInvite} className="shrink-0">
                  {inviteCopied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </div>
            {inviteOpen && (
              <div className="mt-1.5 mb-1">
                {inviteCode ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      readOnly
                      size="sm"
                      aria-label="Enlace de invitación"
                      value={shareUrl(`/join-event/${inviteCode}`)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 min-w-0 truncate"
                    />
                    <Button size="xs" onClick={copyInvite} className="shrink-0">
                      {inviteCopied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="xs" onClick={generateInviteLink} loading={generatingLink}>
                    {generatingLink ? "Generando…" : "Generar enlace"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Evento abierto y por venir: un atajo para buscar gente en la
            Comunidad, con el hilo ya escrito y el enlace al evento. */}
        {event.isAdmin && event.visibility === "public" && !eventIsOver && (
          <Link
            href={communityAnnounceHref(event)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
          >
            📣 Anúncialo en la Comunidad para buscar más jugadores
          </Link>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={switchTab}
        items={visibleTabs.map((tab) => ({ value: tab, label: tabLabel(tab), count: tabCount(tab) }))}
        className="mb-4"
      />

      {/* Tab content */}
      {activeTab === "info" && (
        <div className={cardClass({ padding: "lg" })}>
          {event.about?.trim() ? (
            <>
              <RichText text={event.about} />
              {event.isAdmin && (
                <Button variant="ghost" size="xs" onClick={openEditModal} className="mt-5 -ml-2.5">
                  Editar la info
                </Button>
              )}
            </>
          ) : (
            <EmptyState
              icon="📋"
              title="Aún no hay info general"
              description="Cuenta horarios, normas, qué traer o cómo llegar. Se ve aquí y en la página pública del evento."
              action={<Button onClick={openEditModal}>Añadir info</Button>}
            />
          )}
        </div>
      )}
      {activeTab === "activity" && (
        <div className={cardClass()}>
          <ActivityFeed
            items={feedItems}
            onLoadMore={loadMoreFeed}
            hasMore={feedHasMore}
            loading={feedLoading || !feedLoaded}
          />
        </div>
      )}
      {activeTab === "games" && (
        <GamesTab
          event={event}
          onGeeklistChanged={fetchEvent}
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
          onManualChanged={handleManualChanged}
        />
      )}
      {activeTab === "attendees" && (
        <AttendeesTab
          event={event}
          onSetRole={handleSetAttendeeRole}
          mesa={mesa}
          onOpenMesa={openMesa}
          onCloseMesa={closeMesa}
        />
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

      {/* Edit event modal */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar evento"
        size="lg"
        busy={savingEdit}
        footer={
          <Button onClick={handleSaveEdit} disabled={!editName.trim() || !editDate} loading={savingEdit} block>
            {savingEdit ? "Guardando…" : "Guardar cambios"}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre del evento *">
            {(id) => (
              <EmojiField id={id} multiline={false} value={editName} onChange={setEditName}
                className={fieldClass()} maxLength={200} />
            )}
          </Field>
          <Field label="Descripción corta">
            {(id) => (
              <EmojiField id={id} value={editDescription} onChange={setEditDescription} rows={2}
                placeholder="Una frase que resuma el evento"
                className={fieldClass({ className: "resize-none" })} maxLength={2000} />
            )}
          </Field>
          <Field
            label="Info general"
            hint={
              <>
                Se ve en la pestaña Info general y en la página pública. Usa <code>## </code> para títulos, <code>- </code> para listas y <code>**texto**</code> para negrita; los enlaces se detectan solos.
              </>
            }
          >
            {(id) => (
              <EmojiField id={id} value={editAbout} onChange={setEditAbout} rows={8}
                placeholder={"Horarios, normas, qué traer, cómo llegar…\n\n## Horarios\n- Sábado de 10:00 a 22:00"}
                className={fieldClass({ className: "resize-y" })} maxLength={EVENT_ABOUT_MAX} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha y hora *">
              {(id) => (
                <Input id={id} type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              )}
            </Field>
            <Field label="Fecha fin (opcional)">
              {(id) => (
                <Input id={id} type="datetime-local" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ubicación">
              {(id) => (
                <Input id={id} type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} maxLength={300} />
              )}
            </Field>
            <Field label="Máx. asistentes">
              {(id) => (
                <Input id={id} type="number" value={editMaxAttendees} onChange={(e) => setEditMaxAttendees(e.target.value)} min={1} />
              )}
            </Field>
          </div>
          <div>
            <p className={LABEL_CLASS}>Imagen del evento</p>
            <div className="flex items-center gap-3">
              {editImageUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
                  <Image src={editImageUrl} alt="Vista previa" width={80} height={80} unoptimized className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-xs shrink-0">
                  Sin imagen
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className={buttonClass({ variant: "secondary", size: "sm", className: "cursor-pointer" })}>
                  {uploadingImage ? "Subiendo…" : editImageUrl ? "Cambiar" : "Subir imagen"}
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
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <p className={LABEL_CLASS}>Visibilidad</p>
            <SegmentedControl
              label="Visibilidad"
              value={editVisibility}
              onChange={setEditVisibility}
              options={[
                { value: "public", label: "Público" },
                { value: "private", label: "Privado" },
              ]}
            />
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}

/** Mientras llega el evento: la cabecera ya pintada y el dado debajo. */
function EventLoading() {
  return (
    <>
      <Navbar />
      <PageLoader withNavbar />
    </>
  );
}

// La ficha completa del evento, solo para quien ha iniciado sesión: la sirve
// page.tsx, que a quien llega sin cuenta le enseña la versión pública.
export default function EventClient(props: EventClientProps) {
  return (
    <Suspense fallback={<EventLoading />}>
      <EventDetailPageInner {...props} />
    </Suspense>
  );
}

// ── Games Tab ─────────────────────────────────────────────────────────────

function GamesTab({
  event,
  onGeeklistChanged,
  onAddGame,
  onRemoveGame,
  onSetInterest,
  onRemoveInterest,
  addingGame,
}: {
  event: EventData;
  onGeeklistChanged: () => void;
  onAddGame: (game: { bggId: number }) => void;
  onRemoveGame: (gameId: string) => void;
  onSetInterest: (eventGameId: string, intensity: number) => void;
  onRemoveInterest: (eventGameId: string) => void;
  addingGame: boolean;
}) {
  const isAttending = !!event.currentAttendeeId;
  const linked = !!event.bggGeeklistId;
  const savedSort = useStoredValue(GAME_SORT_KEY);
  const [chosenSort, setSort] = useState<GameSort | null>(null);
  const sort: GameSort =
    chosenSort ?? (GAME_SORTS.some((o) => o.key === savedSort) ? (savedSort as GameSort) : "added");
  const [openGone, setOpenGone] = useState<string | null>(null);

  const chooseSort = (key: GameSort) => {
    setSort(key);
    // Sin almacenamiento: se queda para esta visita
    writeStorage(GAME_SORT_KEY, key);
  };

  const myInterestIn = (eg: EventGame) => eg.interests.find((i) => i.attendeeId === event.currentAttendeeId);
  // «Sin valorar» solo tiene sentido para quien va al evento
  const activeSort: GameSort = sort === "unrated" && !isAttending ? "added" : sort;
  const sorted = sortEventGames(event.games, activeSort, (eg) => !!myInterestIn(eg));
  // Lo que ha salido de la lista va siempre al final, aparte
  const isGone = (eg: EventGame) => linked && !!eg.leftGeeklistAt;
  // Lo que he vetado también va al final, tachado
  const vetoedByMe = (eg: EventGame) => {
    const mine = myInterestIn(eg);
    return !!mine && isVeto(mine.intensity);
  };
  const listed = sorted.filter((eg) => !isGone(eg));
  const games = [...listed.filter((eg) => !vetoedByMe(eg)), ...listed.filter(vetoedByMe)];
  const gone = sorted.filter(isGone);
  const unratedCount = isAttending ? games.filter((eg) => !myInterestIn(eg)).length : 0;

  const intensityPicker = (eg: EventGame, myInterest: Interest | undefined) => (
    <div className="flex flex-wrap gap-1.5">
      {INTENSITY_LEVELS.map((level) => (
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
              : isVeto(level)
                ? "border-dashed border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          } ${isVeto(level) ? "sm:ml-1.5" : ""}`}
          title={INTENSITY_LABELS[level]}
        >
          <span className="sm:hidden">{intensityMark(level)}</span>
          <span className="hidden sm:inline">{intensityText(level)}</span>
        </button>
      ))}
    </div>
  );

  const removeButton = (eg: EventGame, small = false) => (
    <button
      onClick={() => onRemoveGame(eg.game.id)}
      className={`shrink-0 ${small ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm"} flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]/50 transition-colors`}
      title="Eliminar del evento"
      aria-label={`Eliminar ${eg.game.name} del evento`}
    >
      <span aria-hidden>🗑</span>
    </button>
  );

  return (
    <div>
      {event.isAdmin ? (
        <GeeklistPanel eventId={event.id} event={event} onChanged={onGeeklistChanged}>
          <BggGameSearch
            onSelect={onAddGame}
            placeholder="Buscar juego en BGG para añadir…"
            disabled={addingGame}
          />
        </GeeklistPanel>
      ) : (
        <GeeklistNotice event={event} />
      )}

      {games.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)] mr-1">Ordenar:</span>
          <SegmentedControl
            size="sm"
            label="Ordenar juegos"
            value={activeSort}
            onChange={chooseSort}
            className="flex-wrap"
            options={GAME_SORTS.filter((o) => o.key !== "unrated" || isAttending).map((o) => ({
              value: o.key,
              label: (
                <>
                  {o.label}
                  {o.key === "unrated" && unratedCount > 0 && (
                    <span className="ml-1 opacity-75">({unratedCount})</span>
                  )}
                </>
              ),
            }))}
          />
        </div>
      )}

      {games.length === 0 && gone.length === 0 ? (
        <EmptyState
          title={
            linked
              ? event.geeklistSyncedAt
                ? "La lista de BGG aún no tiene juegos"
                : "Los juegos llegarán en cuanto BGG tenga lista la geeklist"
              : event.isAdmin
                ? "Usa el buscador para añadir juegos al evento"
                : "Aún no se han añadido juegos"
          }
        />
      ) : (
        <div className="space-y-3">
          {games.map((eg) => {
            const myInterest = myInterestIn(eg);
            const totalInterested = eg.interests.filter((i) => !isVeto(i.intensity)).length;
            const totalVetoes = eg.interests.length - totalInterested;
            const vetoed = vetoedByMe(eg);

            return (
              <div
                key={eg.id}
                className={cardClass({ padding: "sm", className: `sm:p-4 transition-all duration-200 ${vetoed ? "opacity-70" : ""}` })}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-11 h-11 sm:w-[80px] sm:h-[80px] shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)] ${vetoed ? "grayscale" : ""}`}>
                    {eg.game.thumbnail ? (
                      <Image src={eg.game.thumbnail} alt={eg.game.name} width={80} height={80} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl" aria-hidden>🎲</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--text)] text-sm sm:text-base leading-tight">
                      <a
                        href={bggGameUrl(eg.game.bggId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:text-[var(--primary)] transition-colors ${vetoed ? "line-through decoration-[var(--text-muted)]" : ""}`}
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
                      <GameTags
                        game={{
                          bggRank: eg.game.bggRank,
                          minPlayers: eg.game.minPlayers,
                          maxPlayers: eg.game.maxPlayers,
                          playingTime: eg.game.playingTime,
                        }}
                      />
                      {totalInterested > 0 && (
                        <GameTag tone="green">
                          🙋 {plural(totalInterested, "interesado", "interesados")}
                        </GameTag>
                      )}
                      {totalVetoes > 0 && (
                        <GameTag
                          title={`${totalVetoes} ${totalVetoes === 1 ? "persona no quiere" : "personas no quieren"} jugarlo`}
                        >
                          🚫 {totalVetoes} en contra
                        </GameTag>
                      )}
                    </div>
                  </div>
                  {/* Remove button for creator. Con lista, lo que está en ella
                      volvería en la siguiente importación */}
                  {event.isAdmin && !linked && removeButton(eg)}
                </div>

                {/* Intensity picker for attending users */}
                {isAttending && <div className="mt-3">{intensityPicker(eg, myInterest)}</div>}
              </div>
            );
          })}

          {gone.length > 0 && (
            <div className="!mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40">
              <div className="px-3 sm:px-4 pt-3 pb-2">
                <div className="text-sm font-semibold text-[var(--text-secondary)]">
                  Ya no están en la lista de BGG ({gone.length})
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Se quedan porque alguien había marcado interés, pero puede que no estén en el evento.
                </p>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {gone.map((eg) => {
                  const myInterest = myInterestIn(eg);
                  const open = openGone === eg.id;
                  return (
                    <li key={eg.id} className="px-3 sm:px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <GameThumb src={eg.game.thumbnail} name={eg.game.name} size="xs" fit="contain" className="grayscale opacity-50" />
                        <div className="flex-1 min-w-0 text-sm text-[var(--text-muted)] leading-tight">
                          <a
                            href={bggGameUrl(eg.game.bggId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                          >
                            {eg.game.name}
                          </a>
                          <span className="text-xs ml-1.5">
                            {plural(eg.interests.filter((i) => !isVeto(i.intensity)).length, "interesado", "interesados")}
                          </span>
                        </div>
                        {isAttending && (
                          <button
                            type="button"
                            onClick={() => setOpenGone(open ? null : eg.id)}
                            aria-expanded={open}
                            className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              myInterest
                                ? `${INTENSITY_COLORS[myInterest.intensity]} opacity-70`
                                : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                            }`}
                            title={myInterest ? INTENSITY_LABELS[myInterest.intensity] : "Marcar cuánto te apetece"}
                          >
                            {myInterest ? (
                              <>
                                <span className="sm:hidden">{intensityMark(myInterest.intensity)}</span>
                                <span className="hidden sm:inline">{intensityText(myInterest.intensity)}</span>
                              </>
                            ) : (
                              "Mi interés"
                            )}
                            <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                          </button>
                        )}
                        {event.isAdmin && removeButton(eg, true)}
                      </div>
                      {open && isAttending && <div className="mt-2 sm:pl-[42px]">{intensityPicker(eg, myInterest)}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type GameSort = "added" | "name" | "rank" | "unrated";
const GAME_SORT_KEY = "event-games-sort";
const GAME_SORTS: { key: GameSort; label: string }[] = [
  { key: "added", label: "Por llegada" },
  { key: "name", label: "A–Z" },
  { key: "rank", label: "Ranking BGG" },
  { key: "unrated", label: "Sin valorar" },
];

// Estable: a igualdad, se queda el orden de llegada
function sortEventGames(games: EventGame[], sort: GameSort, rated: (eg: EventGame) => boolean): EventGame[] {
  const byName = (a: EventGame, b: EventGame) =>
    a.game.name.localeCompare(b.game.name, "es", { sensitivity: "base", numeric: true });
  const list = [...games];
  if (sort === "name") return list.sort(byName);
  if (sort === "rank") {
    return list.sort(
      (a, b) =>
        (a.game.bggRank ?? Infinity) - (b.game.bggRank ?? Infinity) ||
        (b.game.bggRating ?? 0) - (a.game.bggRating ?? 0) ||
        byName(a, b)
    );
  }
  if (sort === "unrated") return list.sort((a, b) => Number(rated(a)) - Number(rated(b)));
  return list;
}

// ── My List Tab ───────────────────────────────────────────────────────────

function MyListTab({
  myInterests,
  event,
  onUpdateNotes,
  onTogglePlayed,
  onManualChanged,
}: {
  myInterests: (EventGame & { myInterest: Interest })[];
  event: EventData;
  onUpdateNotes: (eventGameId: string, intensity: number, notes: string) => void;
  onTogglePlayed: (eventGameId: string, intensity: number, played: boolean) => void;
  onManualChanged: (gameId: string, manual: { manualUrl: string | null; manualAddedById: string | null }) => void;
}) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  if (!event.currentAttendeeId) {
    return <EmptyState title="Apúntate al evento para poder crear tu lista de juegos" />;
  }

  if (myInterests.length === 0) {
    return (
      <EmptyState
        title="Aún no has marcado ningún juego"
        description="Ve a la pestaña «Juegos» y marca tus preferencias"
      />
    );
  }

  const pending = myInterests.filter((i) => !i.myInterest.playedAt && !isVeto(i.myInterest.intensity));
  // Los vetados, aparte y al final: no son para jugar, pero se pueden cambiar
  const vetoed = myInterests.filter((i) => !i.myInterest.playedAt && isVeto(i.myInterest.intensity));
  // Los jugados, en el orden en que se marcaron
  const played = myInterests
    .filter((i) => i.myInterest.playedAt)
    .sort((a, b) => a.myInterest.playedAt!.localeCompare(b.myInterest.playedAt!));

  const saveNotes = (eventGameId: string, intensity: number) => {
    onUpdateNotes(eventGameId, intensity, notesValue);
    setEditingNotes(null);
  };

  const renderRow = ({ id: eventGameId, game, myInterest }: EventGame & { myInterest: Interest }, isPlayed: boolean) => {
    const vetoed = isVeto(myInterest.intensity) && !isPlayed;
    return (
      <li key={eventGameId} className="flex items-start gap-3 py-2.5">
        {vetoed ? (
          <span aria-hidden className="w-7 h-7 mt-1.5 shrink-0 flex items-center justify-center text-base">🚫</span>
        ) : (
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
        )}
        <GameThumb
          src={game.thumbnail}
          name={game.name}
          size="sm"
          fit="contain"
          className={`${isPlayed ? "opacity-60" : ""} ${vetoed ? "opacity-60 grayscale" : ""}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
            <a
              href={bggGameUrl(game.bggId)}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-semibold text-sm sm:text-base hover:text-[var(--primary)] transition-colors ${isPlayed || vetoed ? "text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]" : "text-[var(--text)]"}`}
            >
              {game.name}
            </a>
            <span
              className={`inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium border ${INTENSITY_COLORS[myInterest.intensity]} ${isPlayed ? "opacity-60" : ""}`}
              title={INTENSITY_LABELS[myInterest.intensity]}
            >
              <span className="sm:hidden">{intensityMark(myInterest.intensity)}</span>
              <span className="hidden sm:inline">{intensityText(myInterest.intensity)}</span>
            </span>
          </div>

          {editingNotes === eventGameId ? (
            <div className="flex gap-2 mt-1.5">
              <EmojiField
                multiline={false}
                value={notesValue}
                onChange={setNotesValue}
                maxLength={500}
                placeholder="Notas privadas…"
                wrapperClassName="flex-1"
                className={fieldClass({ size: "sm" })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNotes(eventGameId, myInterest.intensity);
                }}
              />
              <Button size="xs" onClick={() => saveNotes(eventGameId, myInterest.intensity)}>
                Guardar
              </Button>
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
              {myInterest.notes ? `📝 ${myInterest.notes}` : "Añadir nota privada…"}
            </button>
          )}
        </div>
        <GameManualLinks
          game={game}
          currentUserId={event.currentUserId}
          onChange={(manual) => onManualChanged(game.id, manual)}
        />
      </li>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-[var(--text-muted)]">Tus notas son privadas: solo las ves tú.</p>
        <Button variant="secondary" size="xs" onClick={() => setShareOpen(true)} title="Compartir mi lista" className="shrink-0">
          ↗ Compartir
        </Button>
      </div>

      {pending.length > 0 ? (
        <div className={cardClass({ padding: "none", className: "px-3 sm:px-4 py-1" })}>
          <ul className="divide-y divide-[var(--border)]">
            {pending.map((item) => renderRow(item, false))}
          </ul>
        </div>
      ) : played.length > 0 ? (
        <EmptyState title="¡Ya has jugado todo lo de tu lista! 🎉" />
      ) : (
        <EmptyState
          title="De momento solo has descartado juegos"
          description="Marca en «Juegos» los que te apetecen"
        />
      )}

      {played.length > 0 && (
        <div className={cardClass({ padding: "none", className: "mt-6 px-3 sm:px-4 py-2" })}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pt-1.5">
            Jugados ({played.length})
          </h3>
          <ul className="divide-y divide-[var(--border)]">
            {played.map((item) => renderRow(item, true))}
          </ul>
        </div>
      )}

      {vetoed.length > 0 && (
        <div className="mt-6 bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)] px-3 sm:px-4 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pt-1.5">
            No quiero jugarlos ({vetoed.length})
          </h3>
          <ul className="divide-y divide-[var(--border)]">
            {vetoed.map((item) => renderRow(item, false))}
          </ul>
        </div>
      )}

      {shareOpen && <ShareListModal eventId={event.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

// ── Compartir Mi Lista ────────────────────────────────────────────────────

function ShareListModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const toast = useToast();
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
      toast(method === "DELETE" ? "Enlace desactivado: ya no se puede abrir" : "Enlace listo para compartir");
    } catch {
      toast.error("No se ha podido cambiar el enlace");
    } finally {
      setBusy(false);
    }
  };

  const url = token ? shareUrl(`/l/${token}`) : "";

  const copy = async () => {
    if (await copyText(url)) toast("Enlace copiado");
    else toast.error("No se ha podido copiar; selecciónalo a mano");
  };

  return (
    <Modal open onClose={onClose} title="Compartir mi lista" busy={busy}>
      {loading ? (
        <div className="h-24 flex items-center justify-center">
          <Spinner size="md" label="Cargando…" />
        </div>
      ) : token ? (
        <>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            <strong>Cualquiera con este enlace</strong> puede ver tu lista para este evento: tus prioridades y lo que
            ya has jugado, siempre al día. Tus notas no salen. No hace falta cuenta y no se puede cambiar nada.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              size="sm"
              aria-label="Enlace para compartir tu lista"
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 font-mono"
            />
            <Button onClick={copy} className="shrink-0">
              Copiar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => call("POST")}
              disabled={busy}
              title="Genera un enlace nuevo; el anterior deja de funcionar"
            >
              Generar uno nuevo
            </Button>
            {confirmRevoke ? (
              <Button variant="danger" size="xs" onClick={() => call("DELETE")} disabled={busy}>
                ¿Seguro? Dejar de compartir
              </Button>
            ) : (
              <Button variant="ghost" size="xs" onClick={() => setConfirmRevoke(true)} className="hover:text-[var(--danger)]!">
                Dejar de compartir
              </Button>
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
          <Button onClick={() => call("POST")} loading={busy} block>
            {busy ? "Creando…" : "Crear enlace para compartir"}
          </Button>
        </>
      )}
    </Modal>
  );
}

// ── Attendees Tab ─────────────────────────────────────────────────────────

function AttendeesTab({
  event,
  onSetRole,
  mesa,
  onOpenMesa,
  onCloseMesa,
}: {
  event: EventData;
  onSetRole: (attendeeId: string, role: "attendee" | "admin") => void;
  mesa: string[] | null;
  onOpenMesa: (attendeeIds: string[]) => void;
  onCloseMesa: () => void;
}) {
  // Con quién armar mesa (ids de asistente). Quien mira, si está apuntado,
  // va siempre incluido y no se marca.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(mesa ?? []));
  const confirm = useConfirm();
  const me = event.currentAttendeeId;

  const togglePicked = (attendeeId: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(attendeeId)) next.delete(attendeeId);
      else next.add(attendeeId);
      return next;
    });
  };

  // La mesa que se enseña: la del enlace, quedándonos con quien siga apuntado
  const mesaMembers = (mesa ?? [])
    .map((id) => event.attendees.find((a) => a.id === id))
    .filter((a): a is Attendee => !!a);
  if (mesaMembers.length >= 2) {
    return (
      <MesaView
        members={mesaMembers}
        games={listedGames(event)}
        currentAttendeeId={me}
        shareUrl={shareUrl(`/events/${event.id}?tab=attendees&mesa=${mesaMembers.map((a) => a.id).join(",")}`)}
        onClose={onCloseMesa}
      />
    );
  }

  // Yo primero, y luego el resto en el orden de la lista
  const selection = [
    ...(me ? [me] : []),
    ...event.attendees.filter((a) => a.id !== me && picked.has(a.id)).map((a) => a.id),
  ];
  const pickedNames = event.attendees
    .filter((a) => a.id !== me && picked.has(a.id))
    .map((a) => displayName(a.user).split(" ")[0]);
  const namesText = joinNames(pickedNames);
  const canPick = event.attendees.length >= 2;

  return (
    <div className={selection.length >= 2 ? "pb-20" : ""}>
      {canPick && (
        <p className="text-xs text-[var(--text-muted)] mb-3">
          🎲 Marca con quién vas a jugar y te decimos qué os apetece a todos.
        </p>
      )}
      {event.attendees.length === 0 ? (
        <EmptyState title="Nadie se ha apuntado todavía" />
      ) : (
        <div className="space-y-3">
          {event.attendees.map((att) => {
            const isCreator = att.userId === event.createdById;
            const isAdmin = !isCreator && att.role === "admin";
            const isSelf = att.userId === event.currentUserId;
            const name = displayName(att.user);
            // Como en grupos: los admins nombran admins; quitarlos, solo el creador
            const canPromote = event.isAdmin && !isCreator && !isAdmin && !isSelf;
            const canDemote = event.isCreator && isAdmin;
            const isPicked = picked.has(att.id);
            // Collect this attendee's interests across all games
            const attendeeInterests = listedGames(event)
              .map((eg) => {
                const interest = eg.interests.find((i) => i.attendeeId === att.id);
                return interest ? { game: eg.game, interest } : null;
              })
              .filter(Boolean) as { game: Game; interest: Interest }[];
            attendeeInterests.sort((a, b) => b.interest.intensity - a.interest.intensity);

            return (
              <div
                key={att.id}
                className={cardClass({
                  padding: "sm",
                  className: `sm:p-4 transition-all duration-200 ${isPicked ? "border-[var(--primary)]!" : ""}`,
                })}
              >
                <div className="flex items-center gap-2">
                  {canPick && !isSelf && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isPicked}
                      aria-label={`${isPicked ? "Quitar a" : "Añadir a"} ${name} de la mesa`}
                      title={isPicked ? "Quitar de la mesa" : "Añadir a la mesa"}
                      onClick={() => togglePicked(att.id)}
                      className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all duration-200 active:scale-90 ${
                        isPicked
                          ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-text)]"
                          : "border-[var(--border-strong)] bg-[var(--input-bg)] text-transparent hover:border-[var(--primary)]"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </button>
                  )}
                  <Link href={profileHref(att.user)} prefetch={false}>
                    <Avatar
                      name={name}
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
                          href={bggUserUrl(att.user.bggUsername)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors ml-1.5 font-normal"
                        >
                          @{att.user.bggUsername}
                        </a>
                      )}
                    </div>
                    {/* Quien creó el evento no se distingue: es un admin más */}
                    {(isCreator || isAdmin) && (
                      <span className="text-xs text-[var(--primary)]">Admin</span>
                    )}
                  </div>
                  <FriendButton user={toFriend(att.user)} />
                  {canPromote && (
                    <Button
                      variant="soft"
                      size="xs"
                      className="shrink-0"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `¿Hacer admin a ${name}?`,
                          body: "Podrá editar el evento, gestionar los juegos y el enlace de invitación.",
                          confirmLabel: "Hacer admin",
                        });
                        if (ok) onSetRole(att.id, "admin");
                      }}
                    >
                      Hacer admin
                    </Button>
                  )}
                  {canDemote && (
                    <Button
                      variant="dangerOutline"
                      size="xs"
                      className="shrink-0"
                      onClick={async () => {
                        const ok = await confirm({ title: `¿Quitar admin a ${name}?`, confirmLabel: "Quitar admin", tone: "danger" });
                        if (ok) onSetRole(att.id, "attendee");
                      }}
                    >
                      Quitar admin
                    </Button>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    att.status === "attending"
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
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
                        <span className="font-bold">{intensityMark(interest.intensity)}</span>
                        <span className={`max-w-[100px] sm:max-w-[150px] truncate ${isVeto(interest.intensity) ? "line-through" : ""}`}>{game.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Barra para abrir la mesa con quien se haya marcado */}
      {selection.length >= 2 && (
        <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 max-w-full">
            <Button size="lg" onClick={() => onOpenMesa(selection)} className="min-w-0 shadow-lg">
              <span className="truncate">🎲 Armar mesa {me ? "con " : ""}{namesText}</span>
            </Button>
            <button
              onClick={() => setPicked(new Set())}
              aria-label="Limpiar selección"
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] shadow-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
