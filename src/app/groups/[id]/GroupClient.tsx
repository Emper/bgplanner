"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { flushSync } from "react-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ActivityFeed, { getCachedFeed, setCachedFeed, clearCachedFeed } from "@/components/ActivityFeed";
import PageLoader from "@/components/PageLoader";
import Avatar from "@/components/Avatar";
import BggRating from "@/components/BggRating";
import GameTags from "@/components/GameTags";
import dynamic from "next/dynamic";
import GroupPlayedGames from "@/components/GroupPlayedGames";
import EmojiField from "@/components/EmojiField";
import FriendButton from "@/components/FriendButton";
import { CountUp, useFlip } from "@/components/motion";
import { formatDateLong, formatDuration, formatRelativeShort } from "@/lib/format";
import { getGroupType, type VoteOption } from "@/lib/groupTypes";
import { compareRanking } from "@/lib/rankingOrder";
import { displayName, profileHref } from "@/lib/users";
import { toFriend } from "@/lib/friends";

// Modales y galería que solo se abren a petición: su código se descarga
// entonces, no con la ficha del grupo.
const GameReviewModal = dynamic(() => import("@/components/GameReviewModal"));
const GroupGallery = dynamic(() => import("@/components/GroupGallery"));
const GameNightModal = dynamic(() => import("@/components/GameNightModal"));

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
  userId: string;
  name: string;
  value: number;
  comment: string | null;
}

interface RankedGame {
  groupGameId: string;
  game: Game;
  addedBy: { name: string | null; displayName: string | null };
  addedById: string;
  score: number;
  voters: Voter[];
  userVoteValue: number | null;
  playCount: number;
  playedAt: string | null;
  archivedAt: string | null;
  lastPlayedDate: string | null;
}

interface Member {
  role: string;
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    surname: string | null;
    bggUsername: string | null;
    avatarUrl: string | null;
    slug: string | null;
  };
}

interface Invitation {
  email: string;
  createdAt: string;
}

interface GroupData {
  id: string;
  name: string;
  type: string;
  members: Member[];
  _count: { games: number };
  invitations: Invitation[];
  currentUserRole: string;
  currentUserId: string;
  currentUserLastPingedAt: string | null;
  inviteCode: string | null;
  inviteEnabled: boolean;
}

interface GameNightData {
  id: string;
  date: string;
  createdBy: { id: string; name: string | null; displayName: string | null };
  players: { user: { id: string; name: string | null; displayName: string | null; avatarUrl: string | null } }[];
  games: { id: string; game: { id: string; bggId: number; name: string; thumbnail: string | null; playingTime: number | null } }[];
}

type Tab = "ranking" | "sessions" | "members" | "activity" | "gallery";

function VoteButton({
  option,
  active,
  onClick,
  size,
  pop = false,
}: {
  option: VoteOption;
  active: boolean;
  onClick: () => void;
  size: "sm" | "md";
  /** Recién pulsado: da un saltito (solo al votar, no al cargar la página). */
  pop?: boolean;
}) {
  const dims = size === "md" ? "w-9 h-9 text-lg" : "w-8 h-8 text-base";
  const activeClass =
    option.tone === "super"
      ? "bg-orange-500/20 border-orange-500 text-orange-400"
      : option.tone === "negative"
        ? "bg-red-500/20 border-red-500 text-red-400"
        : "bg-[var(--accent-soft)] border-[var(--primary)] text-[var(--primary)]";
  const labelColor =
    option.tone === "super"
      ? "text-orange-400/90"
      : option.tone === "negative"
        ? "text-red-400/90"
        : active
          ? "text-[var(--primary)]/90"
          : "text-[var(--text-muted)]";
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 group/vote"
      title={`${option.shortLabel} · ${option.label}`}
    >
      <span
        className={`${dims} flex items-center justify-center rounded-lg border transition-colors ${
          active ? activeClass : "border-[var(--border)] text-[var(--text-muted)] group-hover/vote:bg-[var(--surface-hover)]"
        } ${pop && active ? "fx-vote-pop" : ""}`}
      >
        {option.emoji}
      </span>
      <span className={`text-[9px] font-mono leading-none tabular-nums ${labelColor}`}>
        {option.shortLabel}
      </span>
    </button>
  );
}


// El panel completo del grupo, solo para miembros con sesión: lo sirve
// page.tsx, que a quien llega sin cuenta le enseña la ficha pública.
export default function GroupClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]"><PageLoader /></div>}>
      <GroupDashboardPage />
    </Suspense>
  );
}

function tabFromParam(tab: string | null): Tab {
  return tab === "ranking" || tab === "sessions" || tab === "members" || tab === "gallery" ? tab : "activity";
}

function GroupDashboardPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [ranking, setRanking] = useState<RankedGame[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromParam(searchParams.get("tab")));
  // Opinión post-partida: juego cuyo modal está abierto + modo (marcar / solo reseña)
  const [reviewModal, setReviewModal] = useState<{ gameId: string; gameName: string; mode: "mark" | "review" } | null>(null);
  const [galleryReloadKey, setGalleryReloadKey] = useState(0);
  // Subsección dentro de la pestaña "Juegos": ranking (pendientes) o jugados
  const [gamesSubTab, setGamesSubTab] = useState<"ranking" | "played">("ranking");
  // Orden "congelado" del ranking: al votar la lista no se reordena sola, para
  // no perder el sitio por el que ibas explorando. null = orden real y vivo.
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  // Juegos que has votado desde que se congeló el orden: el botón de
  // reordenar cuenta estos y no todos los que se han descolocado, que al
  // subir un juego diez puestos se mueven también los diez de en medio.
  const [votedWhileFrozen, setVotedWhileFrozen] = useState<Set<string>>(new Set());
  const unfreezeOrder = useCallback(() => {
    setFrozenOrder(null);
    setVotedWhileFrozen(new Set());
  }, []);
  // El último voto, para el saltito del botón y el «+3» que sube del marcador.
  const [voteFx, setVoteFx] = useState<{ id: string; value: number | null; delta: number; key: number } | null>(null);
  const voteFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Al pulsar «Actualizar orden», las tarjetas viajan a su nuevo puesto.
  const rankingFlip = useFlip<HTMLDivElement>();
  // ¿Hay un dedo o un botón del ratón pulsado ahora mismo? Ver closeCommentEditor.
  const pointerDownRef = useRef(false);
  // Editores con el cierre aplazado; votar ese mismo juego lo cancela.
  const pendingCloseRef = useRef<Set<string>>(new Set());
  // Editores que abrió un voto y que nadie ha tocado: como no tienen el foco,
  // no se cierran solos al pinchar fuera. Se cierran al votar otro juego.
  const untouchedEditorsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const down = () => {
      pointerDownRef.current = true;
    };
    const up = () => {
      pointerDownRef.current = false;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingGame, setRemovingGame] = useState<string | null>(null);
  const [openVoteTooltip, setOpenVoteTooltip] = useState<string | null>(null);
  const [openKebabMenu, setOpenKebabMenu] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openCommentEditors, setOpenCommentEditors] = useState<Set<string>>(new Set());
  const [commentToast, setCommentToast] = useState("");
  const [commentError, setCommentError] = useState("");

  // Group activity feed (restore from cache if available)
  const feedCacheKey = `group:${groupId}`;
  const cachedFeed = getCachedFeed(feedCacheKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [feedItems, setFeedItems] = useState<any[]>(cachedFeed?.items ?? []);
  const [feedCursor, setFeedCursor] = useState<string | null>(cachedFeed?.cursor ?? null);
  const [feedHasMore, setFeedHasMore] = useState(!!cachedFeed?.cursor);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoaded, setFeedLoaded] = useState(!!cachedFeed);

  // «¡A jugar!»: quién juega, cuánto tiempo hay y sorteo
  const [showGameNight, setShowGameNight] = useState(false);

  // Ping (convocatoria) modal
  const [showPingModal, setShowPingModal] = useState(false);
  const [pingMessage, setPingMessage] = useState("");
  const [pinging, setPinging] = useState(false);
  const [pingError, setPingError] = useState("");
  const [pingToast, setPingToast] = useState("");
  // Variante destructiva: convocar reiniciando los votos (solo admins).
  // pingConfirmStep = segunda pantalla de reconfirmación del modal.
  const [pingResetVotes, setPingResetVotes] = useState(false);
  const [pingConfirmStep, setPingConfirmStep] = useState(false);

  // Delete group modal (solo propietario)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Group stats (juegos, partidas, horas, juego más jugado, última partida)
  const [stats, setStats] = useState<{
    gamesCount: number;
    playsCount: number;
    totalMinutes: number;
    lastPlayedAt: string | null;
    topGame: { name: string; thumbnail: string | null; playCount: number } | null;
  } | null>(null);

  const [nights, setNights] = useState<GameNightData[]>([]);
  const [nightsToast, setNightsToast] = useState("");

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

  // Sync tab to URL. Cambiar de pestaña deja historial (push) para que
  // «atrás» vuelva a la anterior; lo demás reemplaza la entrada.
  const updateUrl = useCallback((tab: Tab, push = false) => {
    const params = new URLSearchParams();
    if (tab !== "activity") params.set("tab", tab);
    const query = params.toString();
    const url = `/groups/${groupId}${query ? `?${query}` : ""}`;
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }, [router, groupId]);

  const fetchGroupFeed = useCallback(async (cursor?: string) => {
    setFeedLoading(true);
    try {
      const url = `/api/groups/${groupId}/feed?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setFeedItems((prev) => {
            const seen = new Set(prev.map((i: { id: string }) => i.id));
            const merged = [...prev, ...data.items.filter((i: { id: string }) => !seen.has(i.id))];
            setCachedFeed(`group:${groupId}`, merged, data.nextCursor);
            return merged;
          });
        } else {
          setFeedItems(data.items);
          setCachedFeed(`group:${groupId}`, data.items, data.nextCursor);
        }
        setFeedCursor(data.nextCursor);
        setFeedHasMore(!!data.nextCursor);
        setFeedLoaded(true);
      }
    } finally {
      setFeedLoading(false);
    }
  }, [groupId]);

  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    updateUrl(tab, true);
    if (tab === "activity") fetchGroupFeed();
  }, [updateUrl, fetchGroupFeed]);

  // Atrás y adelante del navegador: si la URL cambia de pestaña sin pasar
  // por switchTab, la pestaña la sigue. Se compara con una ref para no pisar
  // un cambio propio mientras el router aún no ha actualizado la URL.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const urlTab = tabFromParam(searchParams.get("tab"));
  useEffect(() => {
    if (urlTab === activeTabRef.current) return;
    setActiveTab(urlTab);
    if (urlTab === "activity") fetchGroupFeed();
  }, [urlTab, fetchGroupFeed]);

  // Load feed if tab starts as "activity"
  useEffect(() => {
    if (activeTab === "activity" && !feedLoaded) fetchGroupFeed();
  }, [activeTab, feedLoaded, fetchGroupFeed]);

  // Al cambiar de pestaña/subpestaña descongelamos: se ve el orden real.
  useEffect(() => {
    unfreezeOrder();
  }, [activeTab, gamesSubTab, unfreezeOrder]);

  // Close mobile vote tooltip when tapping outside
  useEffect(() => {
    if (!openVoteTooltip) return;
    const handleClick = () => setOpenVoteTooltip(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openVoteTooltip]);

  // Close kebab menu when tapping outside
  useEffect(() => {
    if (!openKebabMenu) return;
    const handleClick = () => setOpenKebabMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openKebabMenu]);

  const fetchData = useCallback(async () => {
    try {
      // Single API call loads everything: group, ranking, nights
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
      unfreezeOrder();
      setNights(data.nights);
      setStats(data.stats ?? null);
      if (data.group) {
        setInviteLinkCode(data.group.inviteCode);
        setInviteLinkEnabled(data.group.inviteEnabled ?? true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [groupId, unfreezeOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Split into pending (not yet played) and played. Las partidas de las
  // noches de juego también dejan playedAt.
  const isPlayed = (item: RankedGame) => item.playedAt !== null;
  // Pendientes: no jugados y no archivados. Histórico: todos los jugados y
  // también los que se ocultaron en su día (archivados), jugados o no.
  const pendingGames = ranking.filter((item) => !item.archivedAt && !isPlayed(item));
  const playedGames = ranking.filter((item) => isPlayed(item) || item.archivedAt !== null);

  // ── Orden congelado ──────────────────────────────────────────────────────
  // `pendingGames` mantiene el orden real (lo usan el podio, el sorteo, etc.).
  // La lista se pinta con `displayedGames`, que respeta el orden congelado
  // mientras votas; `livePositions` dice a qué puesto subirá cada juego.
  const livePositions = new Map(
    pendingGames.map((item, i) => [item.groupGameId, i + 1] as const)
  );
  const frozenIndexes = frozenOrder
    ? new Map(frozenOrder.map((id, i) => [id, i] as const))
    : null;
  const displayedGames = frozenIndexes
    ? [...pendingGames].sort(
        (a, b) =>
          (frozenIndexes.get(a.groupGameId) ?? Number.MAX_SAFE_INTEGER) -
          (frozenIndexes.get(b.groupGameId) ?? Number.MAX_SAFE_INTEGER)
      )
    : pendingGames;
  // Cuántos juegos están fuera de su puesto real (el botón de reordenar sale
  // si hay alguno) y, de ellos, cuántos has votado tú (lo que dice el botón).
  const outOfPlace = frozenIndexes
    ? displayedGames.filter(
        (item, i) => (livePositions.get(item.groupGameId) ?? i + 1) !== i + 1
      )
    : [];
  const outOfPlaceCount = outOfPlace.length;
  const movedVotesCount = Math.max(
    1,
    outOfPlace.filter((item) => votedWhileFrozen.has(item.groupGameId)).length
  );

  const isAdmin = group?.currentUserRole === "admin" || group?.currentUserRole === "owner";
  const groupTypeCfg = getGroupType(group?.type);
  const voteOptions = groupTypeCfg.allowedVotes;
  const isOwner = group?.currentUserRole === "owner";

  // Votos reales del grupo: los "voters" con value 0 son comentaristas sin
  // voto, así que no cuentan para lo que se borraría al reiniciar.
  const totalVotes = ranking.reduce(
    (acc, item) => acc + item.voters.filter((v) => v.value !== 0).length,
    0
  );
  const podiumBeforeReset = ranking.filter((item) => item.score !== 0).slice(0, 3);

  const PING_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  const pingAvailableAt = group?.currentUserLastPingedAt
    ? new Date(
        new Date(group.currentUserLastPingedAt).getTime() + PING_COOLDOWN_MS
      )
    : null;
  const canPing = !pingAvailableAt || pingAvailableAt.getTime() <= Date.now();

  const handleMarkPlayed = async (gameId: string, gameName: string, played: boolean) => {
    // Marcar como jugado abre el modal de opinión (nota + comentario + fotos).
    // Devolver a pendientes es una acción directa sin modal.
    if (played) {
      setReviewModal({ gameId, gameName, mode: "mark" });
      return;
    }
    if (!confirm(`¿Devolver "${gameName}" a pendientes?`)) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ played: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al devolver a pendientes");
        return;
      }
      fetchData();
    } catch {
      alert("Error al devolver a pendientes");
    }
  };

  // Callback cuando se guarda/marca desde el modal de opinión.
  const handleReviewDone = useCallback(() => {
    fetchData();
    setGalleryReloadKey((k) => k + 1);
  }, [fetchData]);

  // Deep-link ?review=<gameId> (desde el email de encuesta): abre el modal de
  // opinión en modo "review" y limpia el parámetro para no reabrirlo.
  useEffect(() => {
    const reviewGameId = searchParams.get("review");
    if (!reviewGameId || ranking.length === 0) return;
    const match = ranking.find((r) => r.game.id === reviewGameId);
    if (match) {
      setReviewModal({ gameId: match.game.id, gameName: match.game.name, mode: "review" });
      setActiveTab("gallery");
      updateUrl("gallery");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranking, searchParams]);

  // Helper: recompute ranking scores & sort after a local vote change
  const applyVoteLocally = useCallback(
    (
      prev: RankedGame[],
      targetGameDbId: string,
      newValue: number | null,
      oldValue: number | null,
      currentUserId: string
    ): RankedGame[] => {
      return prev
        .map((item) => {
          if (item.groupGameId !== targetGameDbId) return item;
          let { score } = item;
          const previousMe = item.voters.find((v) => v.userId === currentUserId);
          const myComment = previousMe?.comment ?? null;
          let voters = item.voters;
          if (oldValue !== null) {
            score -= oldValue;
            voters = voters.filter((v) => v.userId !== currentUserId);
          }
          if (newValue !== null) {
            score += newValue;
            const myName = previousMe?.name || "Tú";
            voters = [
              ...voters,
              { userId: currentUserId, name: myName, value: newValue, comment: myComment },
            ];
          } else if (myComment) {
            // El voto se va pero el comentario sigue: voter "virtual" con value=0.
            const myName = previousMe?.name || "Tú";
            voters = [
              ...voters,
              { userId: currentUserId, name: myName, value: 0, comment: myComment },
            ];
          }
          return { ...item, score, voters, userVoteValue: newValue };
        })
        .sort(compareRanking);
    },
    []
  );

  const handleVote = async (
    gameId: string,
    gameDbId: string,
    value: number,
    currentValue: number | null
  ) => {
    if (!group) return;
    const isRemove = currentValue === value;
    const newValue = isRemove ? null : value;
    const snapshot = ranking;

    const delta = (newValue ?? 0) - (currentValue ?? 0);
    if (voteFxTimer.current) clearTimeout(voteFxTimer.current);
    setVoteFx({ id: gameDbId, value: newValue, delta, key: Date.now() });
    voteFxTimer.current = setTimeout(() => setVoteFx(null), 1800);
    const groupTypeCfg = getGroupType(group.type);

    // Congelamos el orden que el usuario está viendo: a partir de aquí los votos
    // cambian la puntuación pero no mueven las tarjetas de sitio.
    setFrozenOrder((prev) => prev ?? ranking.map((r) => r.groupGameId));
    setVotedWhileFrozen((prev) => new Set(prev).add(gameDbId));
    // Si el editor de este juego iba a cerrarse (el clic que lo desenfocó es
    // este voto), se queda abierto como siempre.
    if (!isRemove) pendingCloseRef.current.delete(gameDbId);

    // ── Vote-limit conflict: ask before moving (e.g. super vote in friends) ──
    const limit = !isRemove ? groupTypeCfg.voteLimits.find((l) => l.value === value && l.max <= 1) : null;
    const conflicting = limit
      ? ranking.find((r) => r.userVoteValue === value && r.groupGameId !== gameDbId)
      : null;

    if (conflicting) {
      const optionLabel = groupTypeCfg.allowedVotes.find((v) => v.value === value)?.label || `voto de ${value}`;
      const move = confirm(
        `Ya tienes un ${optionLabel.toLowerCase()} en otro juego del grupo. ¿Lo mueves aquí? El anterior se quedará con un voto normal.`
      );
      if (!move) return;

      // El supervoto que se mueve también cambia el otro juego de puesto.
      setVotedWhileFrozen((prev) => new Set(prev).add(conflicting.groupGameId));
      setRanking((prev) => {
        let next = applyVoteLocally(prev, conflicting.groupGameId, 1, value, group.currentUserId);
        next = applyVoteLocally(next, gameDbId, value, currentValue, group.currentUserId);
        return next;
      });
      openCommentEditorAfterVote(gameDbId);

      try {
        const downgradeRes = await fetch(
          `/api/groups/${groupId}/games/${conflicting.game.id}/vote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ value: 1 }),
          }
        );
        if (!downgradeRes.ok) throw new Error();
        const res = await fetch(
          `/api/groups/${groupId}/games/${gameId}/vote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ value }),
          }
        );
        if (!res.ok) throw new Error();
      } catch {
        setRanking(snapshot);
        alert("Error al mover el voto");
      }
      return;
    }

    setRanking((prev) => applyVoteLocally(prev, gameDbId, newValue, currentValue, group.currentUserId));

    // Al votar (no al retirar), abrimos el editor de comentario para invitar a comentar.
    if (!isRemove) openCommentEditorAfterVote(gameDbId);

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
            body: JSON.stringify({ value }),
          }
        );
        if (!res.ok) throw new Error();
      }
    } catch {
      setRanking(snapshot);
      alert("Error al procesar el voto");
    }
  };

  const focusCommentField = (gameDbId: string) => {
    document.getElementById(`comment-${gameDbId}`)?.focus();
  };

  // Tras votar abrimos el editor para invitar a comentar. Con ratón le damos
  // el foco; en táctil no, porque sacaría el teclado y la página daría un
  // salto en cada voto: el campo queda a la vista y basta con tocarlo.
  const openCommentEditorAfterVote = (gameDbId: string) => {
    const stale = [...untouchedEditorsRef.current].filter((id) => id !== gameDbId);
    stale.forEach((id) => untouchedEditorsRef.current.delete(id));
    const update = () =>
      setOpenCommentEditors((prev) => {
        const next = new Set(prev);
        stale.forEach((id) => next.delete(id));
        next.add(gameDbId);
        return next;
      });
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      flushSync(update);
      focusCommentField(gameDbId);
    } else {
      untouchedEditorsRef.current.add(gameDbId);
      update();
    }
  };

  // Abrir a mano sí enfoca (dentro del mismo toque, para que iOS saque el
  // teclado). Si el editor estaba abierto por un voto, sin tocar, se enfoca
  // en vez de cerrarse.
  const toggleCommentEditor = (gameDbId: string) => {
    if (openCommentEditors.has(gameDbId) && !untouchedEditorsRef.current.has(gameDbId)) {
      setOpenCommentEditors((prev) => {
        const next = new Set(prev);
        next.delete(gameDbId);
        return next;
      });
      return;
    }
    untouchedEditorsRef.current.delete(gameDbId);
    flushSync(() =>
      setOpenCommentEditors((prev) => (prev.has(gameDbId) ? prev : new Set(prev).add(gameDbId)))
    );
    focusCommentField(gameDbId);
  };

  // El editor se cierra al perder el foco, y el foco se pierde al PULSAR en
  // otro sitio. Si ese sitio era el voto de un juego de más abajo, al cerrarse
  // el editor la tarjeta encoge, el botón sube bajo el cursor y al soltar ya
  // no estás encima: el clic se perdía. Con algo pulsado, esperamos a que se
  // suelte (y a que llegue el clic) para cerrarlo.
  const closeCommentEditor = (gameDbId: string) => {
    const close = () => {
      if (!pendingCloseRef.current.delete(gameDbId)) return;
      setOpenCommentEditors((prev) => {
        if (!prev.has(gameDbId)) return prev;
        const next = new Set(prev);
        next.delete(gameDbId);
        return next;
      });
    };
    pendingCloseRef.current.add(gameDbId);
    if (!pointerDownRef.current) {
      close();
      return;
    }
    const afterRelease = () => {
      window.removeEventListener("pointerup", afterRelease, true);
      window.removeEventListener("pointercancel", afterRelease, true);
      // El click se despacha justo después del pointerup: cerramos detrás.
      setTimeout(close, 0);
    };
    window.addEventListener("pointerup", afterRelease, true);
    window.addEventListener("pointercancel", afterRelease, true);
  };

  const handleSaveComment = async (
    gameId: string,
    gameDbId: string,
    draft: string
  ) => {
    if (!group) return;
    const currentUserId = group.currentUserId;
    const item = ranking.find((r) => r.groupGameId === gameDbId);
    if (!item) return;

    const me = item.voters.find((v) => v.userId === currentUserId);
    const current = me?.comment ?? null;
    const next = draft.trim() === "" ? null : draft.trim();

    // Cerramos el editor en cualquier caso (al perder foco volvemos al display).
    closeCommentEditor(gameDbId);

    if (next === current) {
      // Sin cambios reales; descartamos el draft para que vuelva al valor del servidor.
      setCommentDrafts((prev) => {
        const { [gameDbId]: _omit, ...rest } = prev;
        void _omit;
        return rest;
      });
      return;
    }

    const snapshot = ranking;

    // Optimista: actualizamos el voter del usuario actual con el nuevo comentario.
    setRanking((prev) =>
      prev.map((r) => {
        if (r.groupGameId !== gameDbId) return r;
        const existing = r.voters.find((v) => v.userId === currentUserId);
        let voters: Voter[];
        if (existing) {
          if (next === null && existing.value === 0) {
            // Voter "virtual" sin voto y sin comentario → se va.
            voters = r.voters.filter((v) => v.userId !== currentUserId);
          } else {
            voters = r.voters.map((v) =>
              v.userId === currentUserId ? { ...v, comment: next } : v
            );
          }
        } else {
          // No existía voter; si hay comentario, creamos uno virtual.
          voters = next
            ? [...r.voters, { userId: currentUserId, name: "Tú", value: r.userVoteValue ?? 0, comment: next }]
            : r.voters;
        }
        return { ...r, voters };
      })
    );

    try {
      const res = await fetch(
        `/api/groups/${groupId}/games/${gameId}/comment`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: draft.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar el comentario");
      }
      setCommentDrafts((prev) => {
        const { [gameDbId]: _omit, ...rest } = prev;
        void _omit;
        return rest;
      });
      if (next) {
        setCommentToast("💬 Comentario guardado");
        setTimeout(() => setCommentToast(""), 3000);
      }
    } catch (err) {
      setRanking(snapshot);
      setCommentError(
        err instanceof Error ? err.message : "Error al guardar el comentario"
      );
      setTimeout(() => setCommentError(""), 4000);
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

  const closePingModal = () => {
    if (pinging) return;
    setShowPingModal(false);
    setPingConfirmStep(false);
    setPingResetVotes(false);
    setPingError("");
  };

  const handlePing = async () => {
    setPingError("");
    setPinging(true);
    const resetVotes = pingResetVotes && isAdmin;
    try {
      const res = await fetch(`/api/groups/${groupId}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(pingMessage.trim() ? { message: pingMessage.trim() } : {}),
          ...(resetVotes ? { resetVotes: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.nextAvailableAt) {
          const when = new Date(data.nextAvailableAt).toLocaleDateString(
            "es-ES",
            { day: "numeric", month: "long" }
          );
          throw new Error(`Ya convocaste esta semana. Disponible el ${when}.`);
        }
        throw new Error(data.error || "Error al convocar");
      }
      setGroup((g) =>
        g ? { ...g, currentUserLastPingedAt: new Date().toISOString() } : g
      );
      setShowPingModal(false);
      setPingConfirmStep(false);
      setPingResetVotes(false);
      setPingMessage("");
      const players = `${data.recipientCount} jugador${
        data.recipientCount !== 1 ? "es" : ""
      }`;
      if (resetVotes) {
        // El ranking y el feed han cambiado en servidor: recargamos.
        clearCachedFeed(feedCacheKey);
        setFeedLoaded(false);
        await fetchData();
        if (activeTab === "activity") fetchGroupFeed();
        setPingToast(
          `🧹 Votos reiniciados y convocatoria enviada a ${players}`
        );
      } else {
        setPingToast(`📯 ¡Convocatoria enviada a ${players}!`);
      }
      setTimeout(() => setPingToast(""), 4000);
    } catch (err: unknown) {
      setPingError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setPinging(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmText !== group.name) return;
    setDeleteError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al eliminar el grupo");
      }
      router.push("/");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Error inesperado");
      setDeleting(false);
    }
  };

  const handleDeleteNight = async (night: GameNightData, gameId?: string) => {
    const lastGame = !gameId || night.games.length <= 1;
    const what = lastGame
      ? "¿Borrar esta sesión?"
      : `¿Quitar "${night.games.find((g) => g.game.id === gameId)?.game.name}" de esta sesión?`;
    if (!confirm(`${what} Los juegos siguen marcados como jugados.`)) return;
    try {
      const res = await fetch(
        `/api/groups/${groupId}/nights/${night.id}${gameId ? `?gameId=${encodeURIComponent(gameId)}` : ""}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo borrar");
      }
      setNights((prev) =>
        lastGame
          ? prev.filter((n) => n.id !== night.id)
          : prev.map((n) => (n.id === night.id ? { ...n, games: n.games.filter((g) => g.game.id !== gameId) } : n))
      );
      setNightsToast(lastGame ? "Sesión borrada" : "Juego quitado de la sesión");
      setTimeout(() => setNightsToast(""), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo borrar");
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <PageLoader withNavbar />
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
      <div className="min-h-screen bg-[var(--bg)] page-pad">
        <div className="page-main">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title">{group.name}</h1>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/20"
                  title={groupTypeCfg.description}
                >
                  <span>{groupTypeCfg.emoji}</span>
                  <span>{groupTypeCfg.label}</span>
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                {group.members.length} miembros &middot; {group._count.games}{" "}
                juegos
              </p>
            </div>
            <div className="relative group/ping shrink-0">
              <button
                onClick={() => canPing && setShowPingModal(true)}
                disabled={!canPing}
                className="px-3 sm:px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-xl hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text)] text-xs sm:text-sm font-semibold transition-all duration-200 shadow-sm"
              >
                📯 <span className="hidden sm:inline">Convocar a los jugadores</span><span className="sm:hidden">Convocar</span>
              </button>
              <span
                role="tooltip"
                className="pointer-events-none opacity-0 group-hover/ping:opacity-100 group-focus-within/ping:opacity-100 absolute right-0 top-full mt-1.5 z-50 w-max max-w-[260px] bg-[var(--bg)] border border-[var(--border-strong)] rounded-lg shadow-xl px-3 py-2 text-xs text-[var(--text-secondary)] text-left transition-opacity duration-150"
              >
                {canPing
                  ? "Envía un email al grupo para pedirles que voten"
                  : `Disponible de nuevo el ${pingAvailableAt?.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-[var(--border)] overflow-x-auto no-scrollbar">
            {(["activity", "ranking", "sessions", "gallery", "members"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 whitespace-nowrap ${
                  activeTab === tab
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {tab === "ranking" ? "Juegos" : tab === "sessions" ? "Sesiones" : tab === "members" ? "Miembros" : tab === "gallery" ? "Galería" : "Actividad"}
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
                      className="px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] text-sm font-semibold shrink-0 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      Añadir juegos
                    </Link>
                  </div>
                  <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6 text-[var(--text-secondary)]">
                    No hay juegos en este grupo todavía. ¡Añade algunos!
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Conmutador de subsección: Ranking (pendientes) / Ya jugados */}
                  <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--surface)" }}>
                    {([
                      { key: "ranking" as const, label: `Ranking (${pendingGames.length})` },
                      { key: "played" as const, label: `Histórico (${playedGames.length})` },
                    ]).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setGamesSubTab(s.key)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        style={
                          gamesSubTab === s.key
                            ? { background: "var(--primary)", color: "var(--primary-text)" }
                            : { color: "var(--text-secondary)" }
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Ranking: juegos pendientes de jugar ── */}
                  {gamesSubTab === "ranking" && (pendingGames.length > 0 ? (
                    <div>
                      <div className="sticky top-[61px] z-10 bg-[var(--bg)] py-2 -mx-1 px-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                            Pendientes de jugar ({pendingGames.length})
                          </h3>
                          <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setShowGameNight(true)}
                                title="¡A jugar!: elige quién juega y cuánto tiempo hay"
                                aria-label="¡A jugar!"
                                className="px-3 py-2.5 rounded-xl border border-[var(--primary)]/40 text-[var(--primary)] hover:bg-[var(--accent-soft)] text-sm font-semibold shrink-0 transition-all duration-200"
                              >
                                🎲<span className="ml-1.5">¡A jugar!</span>
                              </button>
                              <Link
                                href={`/groups/${groupId}/add-games${(() => {
                                  const firstBgg = group.members.find((m) => m.user.bggUsername)?.user.bggUsername;
                                  return firstBgg ? `?user=${encodeURIComponent(firstBgg)}` : "";
                                })()}`}
                                prefetch={false}
                                className="px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] text-sm font-semibold shrink-0 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                Añadir juegos
                              </Link>
                            </div>
                        </div>
                      </div>
                      {/* Available-slot banner for limited votes (e.g. super vote in friends mode) */}
                      {(() => {
                        if (pendingGames.length === 0 || !group) return null;
                        const cfg = getGroupType(group.type);
                        const limit = cfg.voteLimits.find((l) => l.max <= 1);
                        if (!limit) {
                          // Mode without vote limits → show ranking hint instead, if any
                          if (!cfg.rankingHint) return null;
                          return (
                            <div className="flex items-start gap-2 px-3 py-2.5 mb-2 rounded-xl bg-[var(--accent-soft)] border border-[var(--primary)]/15">
                              <span className="text-base shrink-0 mt-0.5">💡</span>
                              <p className="text-xs sm:text-sm text-[var(--primary)] font-medium">{cfg.rankingHint}</p>
                            </div>
                          );
                        }
                        const limitOption = cfg.allowedVotes.find((v) => v.value === limit.value);
                        const usedUserIds = new Set<string>();
                        ranking.forEach((r) => {
                          r.voters.forEach((v) => {
                            if (v.value === limit.value) usedUserIds.add(v.userId);
                          });
                        });
                        const membersWithAvailable = group.members.filter(
                          (m) => !usedUserIds.has(m.user.id)
                        );
                        if (membersWithAvailable.length === 0) return null;
                        const currentUserAvailable = membersWithAvailable.some(
                          (m) => m.user.id === group.currentUserId
                        );
                        const others = membersWithAvailable.filter(
                          (m) => m.user.id !== group.currentUserId
                        );
                        const otherNames = others.map((m) => displayName(m.user));
                        const optionLabel = (limitOption?.label || "super voto").toLowerCase();
                        const otherText = others.length === 1
                          ? `${otherNames[0]} tiene su ${optionLabel} libre`
                          : `${otherNames.join(", ")} tienen su ${optionLabel} libre`;
                        const isMultiLine = currentUserAvailable && others.length > 0;
                        return (
                          <div className={`flex ${isMultiLine ? "items-start" : "items-center"} gap-2 px-3 py-2.5 mb-2 rounded-xl bg-[var(--accent-soft)] border border-[var(--primary)]/15`}>
                            <span className={`text-base shrink-0 ${isMultiLine ? "mt-0.5" : ""}`}>{limitOption?.emoji || "🔥"}</span>
                            <div className="text-xs sm:text-sm text-[var(--primary)]">
                              {currentUserAvailable && (
                                <p className="font-semibold">¡Tienes tu {optionLabel} disponible! Úsalo en el juego que más te apetezca ({limitOption?.shortLabel || "+3"} puntos).</p>
                              )}
                              {others.length > 0 && (
                                <p className={currentUserAvailable ? "mt-0.5 opacity-75 font-normal" : "font-medium"}>
                                  {otherText}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div ref={rankingFlip.ref} className="space-y-3 fx-stagger">
                        {displayedGames.map((item, index) => {
                          const isEditorOpen = openCommentEditors.has(item.groupGameId);
                          const hasOtherComments = item.voters.some(
                            (v) =>
                              v.comment &&
                              v.comment.trim() !== "" &&
                              v.userId !== group?.currentUserId
                          );
                          const myCommentExists = !!item.voters.find(
                            (v) => v.userId === group?.currentUserId
                          )?.comment;
                          // Cuando NO hay nada que mostrar (ni editor abierto ni comentarios)
                          // recuperamos la versión compacta: acciones absolutas en la esquina
                          // inferior derecha y un poco de padding extra para que no pisen.
                          const compact = !isEditorOpen && !hasOtherComments && !myCommentExists;
                          return (
                          <div
                            key={item.groupGameId}
                            data-flip-id={item.groupGameId}
                            className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-3 sm:p-4 transition-all duration-200"
                          >
                            {/* Main row: Position + Thumbnail + Name/Badges + Votes+Score */}
                            <div className="flex items-center gap-2 sm:gap-4">
                              {/* Puesto: medalla en el podio, número en el resto */}
                              <div className="w-7 sm:w-10 shrink-0 flex items-center justify-center">
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
                                  <span className="text-sm sm:text-base font-bold text-[var(--text-muted)]">#{index + 1}</span>
                                )}
                              </div>
                              {/* Thumbnail: 64px en móvil, 130px top 3 / 100px resto en desktop */}
                              <div className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)] ${index < 3 ? 'sm:w-[130px] sm:h-[130px]' : 'sm:w-[100px] sm:h-[100px]'}`}>
                                {item.game.thumbnail ? (
                                  <Image src={item.game.thumbnail} alt={item.game.name} width={130} height={130} className="w-full h-full object-contain" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">?</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[var(--text)] text-sm sm:text-base leading-tight">
                                  <a
                                    href={`https://boardgamegeek.com/boardgame/${item.game.bggId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-[var(--primary)] transition-colors"
                                  >
                                    {item.game.name}
                                  </a>
                                  {item.game.yearPublished && (
                                    <span className="text-[var(--text-muted)] font-normal ml-1 text-xs">({item.game.yearPublished})</span>
                                  )}
                                </div>
                                {/* Badges inline (debajo del título, en ambos breakpoints) */}
                                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1.5 sm:mt-2">
                                  {(() => {
                                    // Puesto real vs. puesto que ocupa ahora mismo en pantalla.
                                    const livePos = livePositions.get(item.groupGameId) ?? index + 1;
                                    if (livePos === index + 1) return null;
                                    const goesUp = livePos < index + 1;
                                    return (
                                      <span
                                        className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${
                                          goesUp
                                            ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                                            : "bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                                        }`}
                                        title={`Al actualizar el orden pasará al puesto ${livePos}`}
                                      >
                                        {goesUp ? "↑" : "↓"} #{livePos}
                                      </span>
                                    );
                                  })()}
                                  {item.game.bggRating && (
                                    <BggRating rating={item.game.bggRating} size={30} />
                                  )}
                                  <GameTags
                                    size="sm"
                                    game={{
                                      bggRank: item.game.bggRank,
                                      minPlayers: item.game.minPlayers,
                                      maxPlayers: item.game.maxPlayers,
                                      playingTime: item.game.playingTime,
                                      weight: item.game.weight,
                                    }}
                                  />
                                </div>
                              </div>
                              {/* Desktop: Vote buttons + Score, vertically centered */}
                              <div className="hidden sm:flex items-center gap-3 shrink-0">
                                <div className="flex gap-1.5 flex-wrap justify-end max-w-[260px]">
                                  {voteOptions.map((opt) => (
                                    <VoteButton
                                      key={opt.value}
                                      option={opt}
                                      active={item.userVoteValue === opt.value}
                                      onClick={() => handleVote(item.game.id, item.groupGameId, opt.value, item.userVoteValue)}
                                      size="md"
                                      pop={voteFx?.id === item.groupGameId && voteFx.value === opt.value}
                                    />
                                  ))}
                                </div>
                                <div className="relative group/score text-center w-12 cursor-default">
                                  <ScoreChip fx={voteFx} id={item.groupGameId} />
                                  <div className="text-xl font-bold text-[var(--text)]">{item.score}</div>
                                  <div className="text-xs text-[var(--text-muted)]">pts</div>
                                  {/* Tooltip with voter breakdown */}
                                  {item.voters.some((v) => v.value !== 0) && (
                                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover/score:block z-50">
                                      <div className="bg-[var(--bg)] border border-[var(--border-strong)] rounded-lg shadow-xl p-3 min-w-[180px] text-left">
                                        <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Votos</div>
                                        <div className="space-y-1.5">
                                          {item.voters.filter((v) => v.value !== 0).map((voter, vi) => (
                                            <div key={vi} className="flex items-center justify-between gap-3 text-xs">
                                              <span className="text-[var(--text-secondary)] truncate max-w-[120px]">{voter.name}</span>
                                              <span className={`font-bold whitespace-nowrap ${voter.value >= 3 ? 'text-orange-400' : voter.value < 0 ? 'text-red-400' : 'text-[var(--primary)]'}`}>
                                                {voter.value > 0 ? '+' : ''}{voter.value}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="border-t border-[var(--border)] mt-2 pt-1.5 flex justify-between text-xs font-bold">
                                          <span className="text-[var(--text-secondary)]">Total</span>
                                          <span className="text-[var(--text)]">{item.score}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Mobile: Score with tap-to-toggle tooltip */}
                              <div className="relative text-center shrink-0 sm:hidden">
                                <ScoreChip fx={voteFx} id={item.groupGameId} />
                                <div
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenVoteTooltip(openVoteTooltip === item.groupGameId ? null : item.groupGameId);
                                  }}
                                >
                                  <div className="text-lg font-bold text-[var(--text)]">{item.score}</div>
                                  <div className="text-[10px] text-[var(--text-muted)]">pts</div>
                                </div>
                                {item.voters.some((v) => v.value !== 0) && openVoteTooltip === item.groupGameId && (
                                  <div className="absolute bottom-full right-0 mb-2 z-50">
                                    <div className="bg-[var(--bg)] border border-[var(--border-strong)] rounded-lg shadow-xl p-3 min-w-[160px] text-left">
                                      <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Votos</div>
                                      <div className="space-y-1.5">
                                        {item.voters.filter((v) => v.value !== 0).map((voter, vi) => (
                                          <div key={vi} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="text-[var(--text-secondary)] truncate max-w-[100px]">{voter.name}</span>
                                            <span className={`font-bold whitespace-nowrap ${voter.value >= 3 ? 'text-orange-400' : voter.value < 0 ? 'text-red-400' : 'text-[var(--primary)]'}`}>
                                              {voter.value > 0 ? '+' : ''}{voter.value}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="border-t border-[var(--border)] mt-2 pt-1.5 flex justify-between text-xs font-bold">
                                        <span className="text-[var(--text-secondary)]">Total</span>
                                        <span className="text-[var(--text)]">{item.score}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2 mobile only: Kebab "Más" (izquierda) + Vote buttons (derecha) */}
                            <div className="flex sm:hidden items-center justify-between gap-2 mt-2.5 pl-9">
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenKebabMenu(openKebabMenu === item.groupGameId ? null : item.groupGameId);
                                  }}
                                  aria-label="Más acciones"
                                  className="inline-flex items-center gap-0 h-8 pl-1 pr-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="5" r="1.6" />
                                    <circle cx="12" cy="12" r="1.6" />
                                    <circle cx="12" cy="19" r="1.6" />
                                  </svg>
                                  <span className="text-[11px] font-medium whitespace-nowrap">Más</span>
                                </button>
                                {openKebabMenu === item.groupGameId && (
                                  <div
                                    className="absolute top-full left-0 mt-1 z-50 bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl shadow-xl py-1 min-w-[180px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => {
                                        setOpenKebabMenu(null);
                                        toggleCommentEditor(item.groupGameId);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                                    >
                                      💬{" "}
                                      {item.voters.find((v) => v.userId === group?.currentUserId)?.comment
                                        ? "Edita tu comentario"
                                        : "Deja un comentario"}
                                    </button>
                                    {isAdmin && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setOpenKebabMenu(null);
                                            handleMarkPlayed(item.game.id, item.game.name, true);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                                        >
                                          Marcar jugado
                                        </button>
                                        <button
                                          onClick={() => {
                                            setOpenKebabMenu(null);
                                            handleRemoveGame(item.game.id, item.game.name);
                                          }}
                                          disabled={removingGame === item.game.id}
                                          className="w-full text-left px-3 py-2 text-sm text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                                        >
                                          Quitar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {voteOptions.map((opt) => (
                                  <VoteButton
                                    key={opt.value}
                                    option={opt}
                                    active={item.userVoteValue === opt.value}
                                    onClick={() => handleVote(item.game.id, item.groupGameId, opt.value, item.userVoteValue)}
                                    size="sm"
                                    pop={voteFx?.id === item.groupGameId && voteFx.value === opt.value}
                                  />
                                ))}
                              </div>
                            </div>
                            {/* Comentarios: input (cuando el editor está abierto) + lista del resto */}
                            {(() => {
                              const isEditorOpen = openCommentEditors.has(item.groupGameId);
                              const me = item.voters.find((v) => v.userId === group?.currentUserId);
                              const myComment = me?.comment ?? null;
                              const visibleComments = item.voters.filter(
                                (v) =>
                                  v.comment &&
                                  v.comment.trim() !== "" &&
                                  (!isEditorOpen || v.userId !== group?.currentUserId)
                              );
                              if (!isEditorOpen && visibleComments.length === 0) return null;
                              const draftValue = commentDrafts[item.groupGameId] ?? myComment ?? "";
                              return (
                                <div className="mt-3 pl-9 sm:pl-14 space-y-2">
                                  {isEditorOpen && (
                                    <EmojiField
                                      id={`comment-${item.groupGameId}`}
                                      onFocus={() => untouchedEditorsRef.current.delete(item.groupGameId)}
                                      rows={1}
                                      maxLength={500}
                                      value={draftValue}
                                      onChange={(text) =>
                                        setCommentDrafts((prev) => ({
                                          ...prev,
                                          [item.groupGameId]: text,
                                        }))
                                      }
                                      onBlur={(e) =>
                                        handleSaveComment(item.game.id, item.groupGameId, e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      placeholder="Deja un comentario (opcional)"
                                      className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all resize-none"
                                    />
                                  )}
                                  {visibleComments.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                      {visibleComments.map((v) => (
                                        <div key={v.userId} className="flex items-start gap-1.5 text-xs leading-relaxed">
                                          <span aria-hidden className="shrink-0 leading-none mt-px">💬</span>
                                          <div className="min-w-0">
                                            <span className="font-semibold text-[var(--text-secondary)]">
                                              {v.name}:
                                            </span>{" "}
                                            <span className="text-[var(--text)] italic">
                                              “{v.comment}”
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {/* Acciones inferiores — desktop: Comenta + (admin) Marcar/Quitar.
                                Si la tarjeta es compacta (sin comentarios ni editor) flotan en la
                                esquina inferior derecha; si hay comentarios, en flujo bajo el bloque. */}
                            <div className={`hidden sm:flex justify-end gap-3 text-[11px] ${compact ? "absolute bottom-2 right-3" : "mt-3"}`}>
                              <button
                                onClick={() => toggleCommentEditor(item.groupGameId)}
                                className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                              >
                                {myCommentExists ? "Edita tu comentario" : "Deja un comentario"}
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleMarkPlayed(item.game.id, item.game.name, true)}
                                    className="text-[var(--text-muted)] hover:text-emerald-400 transition-colors"
                                  >
                                    Marcar jugado
                                  </button>
                                  <button
                                    onClick={() => handleRemoveGame(item.game.id, item.game.name)}
                                    disabled={removingGame === item.game.id}
                                    className="text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
                                  >
                                    Quitar
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
                        ⚖️ Si dos juegos empatan a puntos, va delante el que tiene mejor nota en BGG.
                      </p>
                    </div>
                  ) : (
                    <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                      No hay juegos pendientes de jugar.
                    </p>
                  ))}

                  {/* ── Histórico de partidas ── */}
                  {gamesSubTab === "played" && (
                    <GroupPlayedGames
                      games={playedGames}
                      isAdmin={isAdmin}
                      onOpinion={(gameId, gameName) => setReviewModal({ gameId, gameName, mode: "review" })}
                      onReturn={(gameId, gameName) => handleMarkPlayed(gameId, gameName, false)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* «¡A jugar!»: presentes, tiempo, peso y sorteo */}
          {showGameNight && (
            <GameNightModal
              groupId={groupId}
              groupType={group.type}
              currentUserId={group.currentUserId}
              members={group.members.map((m) => m.user)}
              games={pendingGames}
              onPlayed={() => fetchData()}
              onClose={() => setShowGameNight(false)}
            />
          )}

          {/* Delete group modal — solo propietario, requiere escribir el nombre */}
          {showDeleteModal && (
            <div
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={() => !deleting && setShowDeleteModal(false)}
            >
              <div
                className="bg-[var(--surface)] rounded-2xl border border-red-500/40 shadow-[var(--card-shadow)] p-5 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-red-400">
                    ⚠️ Eliminar grupo
                  </h3>
                  <button
                    onClick={() => !deleting && setShowDeleteModal(false)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text)]"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3 mb-4 text-sm text-[var(--text-secondary)]">
                  <p>
                    Vas a eliminar <strong className="text-[var(--text)]">&quot;{group.name}&quot;</strong> de forma permanente. Se borrarán:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[var(--text-muted)]">
                    <li>Todos sus juegos y votos</li>
                    <li>Todas sus sesiones</li>
                    <li>Todos los miembros e invitaciones pendientes</li>
                    <li>Todo el historial de actividad del grupo</li>
                  </ul>
                  <p className="text-red-400 font-medium">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                    Para confirmar, escribe el nombre exacto del grupo: <span className="font-mono text-[var(--text)]">{group.name}</span>
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={group.name}
                    autoFocus
                    disabled={deleting}
                    className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-red-500/40 focus:border-red-500 focus:outline-none transition-all duration-200"
                  />
                </div>
                {deleteError && (
                  <p className="text-sm text-red-400 mb-3">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 bg-[var(--surface-hover)] text-[var(--text)] rounded-xl hover:bg-[var(--border)] disabled:opacity-50 font-semibold text-sm transition-all duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteGroup}
                    disabled={deleting || deleteConfirmText !== group.name}
                    className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all duration-200 shadow-sm"
                  >
                    {deleting ? "Eliminando..." : "Eliminar para siempre"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ping modal — dos pasos cuando se reinician los votos */}
          {showPingModal && (
            <div
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={closePingModal}
            >
              <div
                className={`bg-[var(--surface)] rounded-2xl border shadow-[var(--card-shadow)] p-5 w-full max-w-md ${
                  pingConfirmStep ? "border-red-500/40" : "border-[var(--border)]"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {pingConfirmStep ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-red-400">
                        ⚠️ ¿Seguro que quieres reiniciar los votos?
                      </h3>
                      <button
                        onClick={closePingModal}
                        className="text-[var(--text-secondary)] hover:text-[var(--text)]"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-3 mb-4 text-sm text-[var(--text-secondary)]">
                      <p>
                        Se borrarán{" "}
                        <strong className="text-[var(--text)]">
                          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
                        </strong>{" "}
                        de todos los miembros del grupo y el ranking se quedará a cero.
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 pl-1 text-[var(--text-muted)]">
                        <li>Los juegos <strong className="text-[var(--text-secondary)]">no</strong> se quitan del ranking</li>
                        <li>Los comentarios de cada juego se mantienen</li>
                        <li>Se avisará por email a los demás miembros</li>
                      </ul>
                      {podiumBeforeReset.length > 0 && (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                          <p className="text-xs text-[var(--text-muted)] mb-2">
                            Guardaremos este podio en la actividad del grupo:
                          </p>
                          <ul className="space-y-1">
                            {podiumBeforeReset.map((item, i) => (
                              <li
                                key={item.groupGameId}
                                className="flex items-center justify-between gap-3 text-sm text-[var(--text)]"
                              >
                                <span className="truncate">
                                  {["🥇", "🥈", "🥉"][i]} {item.game.name}
                                </span>
                                <span className="shrink-0 font-semibold text-[var(--primary)]">
                                  {item.score} pts
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-red-400 font-medium">
                        Esta acción no se puede deshacer.
                      </p>
                    </div>
                    {pingError && (
                      <p className="text-sm text-red-400 mb-3">{pingError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPingConfirmStep(false)}
                        disabled={pinging}
                        className="flex-1 px-4 py-2.5 bg-[var(--surface-hover)] text-[var(--text)] rounded-xl hover:bg-[var(--border)] disabled:opacity-50 font-semibold text-sm transition-all duration-200"
                      >
                        Volver
                      </button>
                      <button
                        onClick={handlePing}
                        disabled={pinging}
                        className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all duration-200 shadow-sm"
                      >
                        {pinging ? "Reiniciando..." : "Sí, borrar los votos"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-[var(--text)]">
                        📯 ¿Convocar a los jugadores?
                      </h3>
                      <button
                        onClick={closePingModal}
                        className="text-[var(--text-secondary)] hover:text-[var(--text)]"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      Esto enviará un email a los demás miembros del grupo para pedirles que actualicen sus votos en el ranking. Solo puedes hacerlo una vez por semana.
                    </p>
                    <div className="mb-4">
                      <label className="block text-xs text-[var(--text-secondary)] mb-1">
                        Mensaje personal (opcional)
                      </label>
                      <EmojiField
                        value={pingMessage}
                        onChange={setPingMessage}
                        maxLength={200}
                        placeholder="Ej: vamos el viernes a casa de Ana"
                        rows={3}
                        className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200 resize-none"
                      />
                      <div className="text-right text-xs text-[var(--text-muted)] mt-1">
                        {pingMessage.length}/200
                      </div>
                    </div>
                    {isAdmin && (
                      <label
                        className={`flex items-start gap-3 mb-4 p-3 rounded-xl border cursor-pointer transition-colors duration-200 ${
                          pingResetVotes
                            ? "border-red-500/40 bg-red-500/5"
                            : "border-[var(--border)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={pingResetVotes}
                          onChange={(e) => setPingResetVotes(e.target.checked)}
                          disabled={pinging}
                          className="mt-0.5 w-4 h-4 shrink-0 accent-red-500"
                        />
                        <span className="text-sm">
                          <span className="block font-semibold text-[var(--text)]">
                            🧹 Empezar de cero: borrar los votos actuales
                          </span>
                          <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
                            Se borran los {totalVotes} voto{totalVotes !== 1 ? "s" : ""} del grupo y los juegos se quedan. Solo para admins.
                          </span>
                        </span>
                      </label>
                    )}
                    {pingError && (
                      <p className="text-sm text-red-400 mb-3">{pingError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={closePingModal}
                        disabled={pinging}
                        className="flex-1 px-4 py-2.5 bg-transparent border border-[var(--border)] text-[var(--text)] rounded-xl hover:bg-[var(--border)]/30 disabled:opacity-50 font-semibold text-sm transition-all duration-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (pingResetVotes) {
                            setPingError("");
                            setPingConfirmStep(true);
                          } else {
                            handlePing();
                          }
                        }}
                        disabled={pinging}
                        className={`flex-1 px-4 py-2.5 rounded-xl disabled:opacity-50 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md ${
                          pingResetVotes
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-[var(--primary)] text-[var(--primary-text)] hover:bg-[var(--primary-hover)]"
                        }`}
                      >
                        {pinging
                          ? "Enviando..."
                          : pingResetVotes
                            ? "Continuar"
                            : "Convocar 📯"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Botón flotante: aplica el nuevo orden cuando el usuario quiera */}
          {activeTab === "ranking" && gamesSubTab === "ranking" && outOfPlaceCount > 0 && (
            <button
              onClick={() => {
                rankingFlip.capture();
                unfreezeOrder();
              }}
              className="fx-toast-in fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[var(--primary)] text-[var(--primary-text)] px-4 py-3 rounded-xl shadow-lg font-semibold text-sm hover:bg-[var(--primary-hover)] transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar orden ({movedVotesCount} {movedVotesCount === 1 ? "voto" : "votos"})
            </button>
          )}

          {/* Ping success toast */}
          {pingToast && (
            <div className="fx-toast-in fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--primary)] text-[var(--primary-text)] px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
              {pingToast}
            </div>
          )}

          {/* Comment toasts */}
          {commentToast && (
            <div className="fx-toast-in fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--primary)] text-[var(--primary-text)] px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
              {commentToast}
            </div>
          )}
          {commentError && (
            <div className="fx-toast-in fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
              {commentError}
            </div>
          )}

          {/* ═══════════ Sessions Tab ═══════════ */}
          {activeTab === "sessions" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--primary)]/25 bg-[var(--accent-soft)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                <div className="text-4xl leading-none" aria-hidden>🎲</div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-[var(--text)]">¿Se juega hoy?</h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Marca quién se sienta a la mesa y cuánto tiempo tenéis: os enseñamos lo que encaja, ordenado con
                    los votos de los que estáis, y si no os decidís, lo sorteamos.
                  </p>
                </div>
                <button
                  onClick={() => setShowGameNight(true)}
                  disabled={pendingGames.length === 0}
                  className="px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 text-sm font-semibold shrink-0 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  ¡A jugar!
                </button>
              </div>

              {nights.length === 0 ? (
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6 text-center text-sm text-[var(--text-secondary)]">
                  {pendingGames.length === 0
                    ? "Añade juegos al ranking y jugad vuestra primera sesión."
                    : "Todavía no habéis apuntado ninguna sesión. Lo que juguéis desde «¡A jugar!» queda guardado aquí, con quién estaba."}
                </div>
              ) : (
                <ul className="space-y-3">
                  {nights.map((night) => {
                    const canDelete = isAdmin || night.createdBy.id === group.currentUserId;
                    const minutes = night.games.reduce((acc, g) => acc + (g.game.playingTime || 0), 0);
                    return (
                      <li
                        key={night.id}
                        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text)] first-letter:uppercase">
                              {formatDateLong(night.date)}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {night.games.length} {night.games.length === 1 ? "partida" : "partidas"}
                              {minutes > 0 && <> · ⏱ {formatDuration(minutes)}</>}
                            </p>
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteNight(night)}
                              className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
                            >
                              Borrar
                            </button>
                          )}
                        </div>

                        {night.players.length > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {night.players.map(({ user }) => {
                              const name = user.displayName || user.name || "Alguien";
                              return (
                                <span
                                  key={user.id}
                                  className="inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-xs text-[var(--text-secondary)]"
                                >
                                  <Avatar name={name} avatarUrl={user.avatarUrl} size="xs" />
                                  {name}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-[var(--text-muted)] italic">
                            Sin apuntar quién jugó (es de antes de que lo guardáramos)
                          </p>
                        )}

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {night.games.map(({ game }) => (
                            <div key={game.id} className="flex items-center gap-2.5 rounded-xl bg-[var(--input-bg)] p-2">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--surface-hover)] shrink-0">
                                {game.thumbnail ? (
                                  <Image src={game.thumbnail} alt="" width={40} height={40} className="w-full h-full object-contain" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-sm">🎲</div>
                                )}
                              </div>
                              <span className="flex-1 min-w-0 text-sm font-medium text-[var(--text)] truncate">{game.name}</span>
                              {canDelete && night.games.length > 1 && (
                                <button
                                  onClick={() => handleDeleteNight(night, game.id)}
                                  aria-label={`Quitar ${game.name} de esta sesión`}
                                  className="text-[var(--text-muted)] hover:text-red-400 text-xs px-1.5 shrink-0"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {nightsToast && (
                <div className="fx-toast-in fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--primary)] text-[var(--primary-text)] px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
                  {nightsToast}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ Members Tab ═══════════ */}
          {activeTab === "members" && (
            <div className="space-y-6">
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Miembros</h2>
                <div className="space-y-3">
                  {group.members.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Link href={profileHref(member.user)} prefetch={false}>
                          <Avatar
                            name={displayName(member.user)}
                            avatarUrl={member.user.avatarUrl}
                            size="sm"
                          />
                        </Link>
                        <div>
                          <Link
                            href={profileHref(member.user)}
                            prefetch={false}
                            className="font-medium text-[var(--text)] hover:text-[var(--primary)] transition-colors"
                          >
                            {member.user.name
                              ? `${member.user.name} ${member.user.surname || ""}`.trim()
                              : displayName(member.user)}
                          </Link>
                          {member.user.bggUsername && (
                            <a
                              href={`https://boardgamegeek.com/user/${member.user.bggUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors ml-1"
                            >
                              @{member.user.bggUsername}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <FriendButton user={toFriend(member.user)} />
                        {/* Hacer admin: visible para admins/owners, en miembros que no son admin/owner */}
                        {isAdmin && member.role === "member" && member.user.id !== group.currentUserId && (
                          <button
                            onClick={async () => {
                              const name = displayName(member.user);
                              if (!confirm(`¿Hacer admin a ${name}?`)) return;
                              const res = await fetch(`/api/groups/${groupId}/members/${member.user.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ role: "admin" }),
                              });
                              if (res.ok) fetchData();
                              else {
                                const data = await res.json();
                                alert(data.error || "Error al cambiar rol");
                              }
                            }}
                            className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-soft)] text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
                          >
                            Hacer admin
                          </button>
                        )}
                        {/* Quitar admin: solo visible para el owner, en admins */}
                        {isOwner && member.role === "admin" && (
                          <button
                            onClick={async () => {
                              const name = displayName(member.user);
                              if (!confirm(`¿Quitar admin a ${name}? Pasará a ser miembro.`)) return;
                              const res = await fetch(`/api/groups/${groupId}/members/${member.user.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ role: "member" }),
                              });
                              if (res.ok) fetchData();
                              else {
                                const data = await res.json();
                                alert(data.error || "Error al cambiar rol");
                              }
                            }}
                            className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            Quitar admin
                          </button>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            member.role === "owner"
                              ? "bg-[var(--primary)]/30 text-[var(--primary)]"
                              : member.role === "admin"
                                ? "bg-[var(--accent-soft)] text-[var(--primary)]"
                                : "bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {member.role === "owner" ? "Propietario" : member.role === "admin" ? "Admin" : "Miembro"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enlace de invitación */}
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Enlace de invitación</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Comparte este enlace para que cualquiera pueda unirse al grupo.
                </p>

                {inviteLinkCode ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteLinkCode}`}
                        className="flex-1 min-w-0 px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-secondary)] text-xs sm:text-sm font-mono truncate transition-all duration-200"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/join/${inviteLinkCode}`);
                          setInviteLinkCopied(true);
                          setTimeout(() => setInviteLinkCopied(false), 2000);
                        }}
                        className="px-3 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] font-semibold text-sm whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        {inviteLinkCopied ? "¡Copiado!" : "Copiar"}
                      </button>
                    </div>

                    {isAdmin && (
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
                            className={`relative w-10 h-5 rounded-full transition-all duration-200 ${
                              inviteLinkEnabled ? "bg-[var(--primary)]" : "bg-[var(--surface-hover)]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                inviteLinkEnabled ? "translate-x-5" : ""
                              }`}
                            />
                          </button>
                          <span className="text-sm text-[var(--text-secondary)]">
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
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          Regenerar enlace
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {isAdmin ? (
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
                        className="px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        {inviteLinkLoading ? "Generando..." : "Generar enlace de invitación"}
                      </button>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">
                        No hay enlace de invitación activo. Solo un admin puede generarlo.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Invitar por email</h2>
                <form onSubmit={handleInvite} className="flex gap-3">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="flex-1 px-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] focus:outline-none transition-all duration-200"
                  />
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {inviting ? "Enviando..." : "Invitar"}
                  </button>
                </form>
                {inviteMsg && <p className="text-sm text-green-400 mt-2">{inviteMsg}</p>}
                {inviteError && <p className="text-sm text-red-400 mt-2">{inviteError}</p>}
              </div>

              {group.invitations.length > 0 && (
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-6">
                  <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Invitaciones pendientes</h2>
                  <div className="space-y-2">
                    {group.invitations.map((inv) => (
                      <div
                        key={inv.email}
                        className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                      >
                        <span className="text-sm text-[var(--text-secondary)]">{inv.email}</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(inv.createdAt).toLocaleDateString("es-ES")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Zona peligrosa: solo el propietario puede eliminar el grupo ── */}
              {isOwner && (
                <div className="bg-[var(--surface)] rounded-2xl border border-red-500/30 shadow-[var(--card-shadow)] p-6">
                  <h2 className="text-lg font-semibold text-red-400 mb-2">Zona peligrosa</h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Eliminar el grupo borra para siempre todos sus miembros, juegos, votos, sesiones e invitaciones. <strong className="text-[var(--text)]">Esta acción no se puede deshacer.</strong>
                  </p>
                  <button
                    onClick={() => {
                      setDeleteConfirmText("");
                      setDeleteError("");
                      setShowDeleteModal(true);
                    }}
                    className="px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/20 hover:border-red-500/50 font-semibold text-sm transition-all duration-200"
                  >
                    Eliminar este grupo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ Activity Tab ═══════════ */}
          {/* ═══════════ Galería Tab ═══════════ */}
          {activeTab === "gallery" && group && (
            <GroupGallery
              groupId={groupId}
              currentUserId={group.currentUserId}
              isAdmin={group.currentUserRole === "admin" || group.currentUserRole === "owner"}
              reloadKey={galleryReloadKey}
              onAddOpinion={(gameId, gameName) => setReviewModal({ gameId, gameName, mode: "review" })}
            />
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              {/* Podio: 3 juegos más votados ahora mismo (entre los pendientes) */}
              {(() => {
                const topThree = pendingGames.filter((g) => g.score > 0).slice(0, 3);
                if (topThree.length === 0) return null;
                const order: { rank: 1 | 2 | 3; game: RankedGame | undefined }[] = [
                  { rank: 2, game: topThree[1] },
                  { rank: 1, game: topThree[0] },
                  { rank: 3, game: topThree[2] },
                ];
                return (
                  <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4 sm:p-5">
                    <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
                      🏆 Podio del grupo
                    </h2>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
                      {order.map(({ rank, game }) => {
                        if (!game) {
                          return <div key={`empty-${rank}`} aria-hidden />;
                        }
                        const stepHeight =
                          rank === 1
                            ? "h-14 sm:h-16"
                            : rank === 2
                              ? "h-10 sm:h-12"
                              : "h-7 sm:h-9";
                        const gradient =
                          rank === 1
                            ? "from-amber-300 via-yellow-400 to-amber-600"
                            : rank === 2
                              ? "from-slate-200 via-slate-400 to-slate-500"
                              : "from-amber-600 via-amber-700 to-amber-900";
                        const ring =
                          rank === 1
                            ? "ring-yellow-400/60"
                            : rank === 2
                              ? "ring-slate-400/60"
                              : "ring-amber-700/60";
                        const thumbDim = rank === 1 ? "w-16 h-16 sm:w-20 sm:h-20" : "w-12 h-12 sm:w-16 sm:h-16";
                        return (
                          <button
                            key={game.groupGameId}
                            onClick={() => switchTab("ranking")}
                            className="group/podium flex flex-col items-center text-center min-w-0 cursor-pointer"
                            title={`${game.game.name} · ${game.score} pts`}
                          >
                            <span className={`h-6 mb-1 text-xl sm:text-2xl leading-none ${rank === 1 ? "fx-crown" : ""}`} aria-hidden>
                              {rank === 1 ? "👑" : ""}
                            </span>
                            <div className={`${thumbDim} rounded-lg overflow-hidden ring-2 ${ring} bg-[var(--surface-hover)] mb-2 transition-transform group-hover/podium:scale-105`}>
                              {game.game.thumbnail ? (
                                <Image
                                  src={game.game.thumbnail}
                                  alt=""
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">?</div>
                              )}
                            </div>
                            <div className="text-[11px] sm:text-sm font-semibold text-[var(--text)] leading-tight line-clamp-2 w-full px-0.5">
                              {game.game.name}
                            </div>
                            <div className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-0.5 mb-2">
                              {game.score} pts
                            </div>
                            {/* Las gradas suben al entrar con suspense: bronce, plata y el oro al final */}
                            <div
                              className={`fx-grow-up w-full ${stepHeight} rounded-t-xl bg-gradient-to-b ${gradient} flex items-start justify-center pt-1 sm:pt-1.5`}
                              style={{ animationDelay: `${rank === 3 ? 100 : rank === 2 ? 300 : 550}ms` }}
                            >
                              <span className="text-white text-base sm:text-lg font-bold drop-shadow">{rank}º</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {stats && (
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4 sm:p-5">
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                    El grupo en números
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatTile label="Juegos" value={<CountUp value={stats.gamesCount} />} />
                    <StatTile label="Partidas" value={<CountUp value={stats.playsCount} />} />
                    <StatTile
                      label="A la mesa"
                      value={stats.totalMinutes > 0 ? formatDuration(stats.totalMinutes) : "—"}
                    />
                    <StatTile
                      label="Última partida"
                      value={stats.lastPlayedAt ? formatRelativeShort(stats.lastPlayedAt) : "Aún ninguna"}
                    />
                  </div>
                  {stats.topGame && stats.topGame.playCount > 1 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center gap-3">
                      {stats.topGame.thumbnail ? (
                        <Image
                          src={stats.topGame.thumbnail}
                          alt=""
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[var(--surface-hover)] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                          Juego más jugado
                        </div>
                        <div className="text-sm font-medium text-[var(--text)] truncate">
                          {stats.topGame.name}
                          <span className="text-[var(--text-secondary)] font-normal"> · {stats.topGame.playCount} {stats.topGame.playCount === 1 ? "partida" : "partidas"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] p-4">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Actividad del grupo</h2>
                <ActivityFeed
                  items={feedItems}
                  onLoadMore={() => feedCursor && fetchGroupFeed(feedCursor)}
                  hasMore={feedHasMore}
                  loading={feedLoading}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {reviewModal && (
        <GameReviewModal
          groupId={groupId}
          gameId={reviewModal.gameId}
          gameName={reviewModal.gameName}
          mode={reviewModal.mode}
          onClose={() => setReviewModal(null)}
          onDone={handleReviewDone}
        />
      )}

      <Footer />
    </>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="text-lg font-semibold text-[var(--text)] tabular-nums">{value}</div>
    </div>
  );
}

// El «+1», «+3» o «−1» que sube del marcador al votar.
function ScoreChip({
  fx,
  id,
}: {
  fx: { id: string; delta: number; key: number } | null;
  id: string;
}) {
  if (!fx || fx.id !== id || fx.delta === 0) return null;
  const tone =
    fx.delta >= 3
      ? "bg-orange-500 text-white"
      : fx.delta < 0
        ? "bg-red-500 text-white"
        : "bg-[var(--primary)] text-[var(--primary-text)]";
  return (
    <span
      key={fx.key}
      className={`fx-chip-rise pointer-events-none absolute left-1/2 -translate-x-1/2 -top-5 z-10 whitespace-nowrap text-[11px] font-bold px-1.5 py-0.5 rounded-md shadow ${tone}`}
    >
      {fx.delta > 0 ? `+${fx.delta}` : `−${Math.abs(fx.delta)}`}
    </span>
  );
}
