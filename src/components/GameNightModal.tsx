"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Avatar from "@/components/Avatar";
import BggRating from "@/components/BggRating";
import { formatDuration } from "@/lib/format";
import { findVoteOption } from "@/lib/groupTypes";
import {
  buildNight,
  nightPool,
  DEFAULT_NIGHT_MINUTES,
  NIGHT_TIMES,
  NIGHT_WEIGHTS,
  type NightRow,
  type WeightId,
} from "@/lib/gameNight";

interface NightGame {
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

export interface NightItem {
  groupGameId: string;
  game: NightGame;
  voters: { userId: string; value: number }[];
}

interface NightMember {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
}

interface Props {
  groupId: string;
  groupType: string;
  currentUserId: string;
  members: NightMember[];
  /** Pendientes del grupo (sin jugados ni archivados). */
  games: NightItem[];
  /** Tras apuntar una partida: el grupo recarga ranking, sesiones y cifras. */
  onPlayed: () => void;
  onClose: () => void;
}

type Row = NightRow<NightItem>;

/** Nº de juegos que desfilan por la ruleta antes de parar. */
const TICKS = 22;

const CONFETTI_COLORS = ["#f59e0b", "#fbbf24", "#34d399", "#60a5fa", "#c084fc", "#f87171"];

interface ConfettiPiece {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  color: string;
  round: boolean;
}

/** Un sorteo concreto: de dónde arranca la ruleta, dónde para y su confeti. */
interface Draw {
  pool: Row[];
  start: number;
  picked: number;
  /** Sin animación: elegido a dedo, un solo juego o menos movimiento. */
  instant: boolean;
  /** Elegido a dedo desde la lista, no por sorteo. */
  manual: boolean;
  confetti: ConfettiPiece[];
}

function buildConfetti(): ConfettiPiece[] {
  return Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 7,
    delay: Math.random() * 0.45,
    duration: 1.9 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 180,
    spin: 360 + Math.random() * 720,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
  }));
}

function newDraw(pool: Row[]): Draw {
  const confetti = buildConfetti();
  const picked = Math.floor(Math.random() * pool.length);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced || pool.length === 1) {
    return { pool, start: picked, picked, instant: true, manual: false, confetti };
  }
  // La ruleta avanza un juego por tick, así que arranca TICKS antes del ganador.
  const start = (((picked - TICKS) % pool.length) + pool.length) % pool.length;
  return { pool, start, picked, instant: false, manual: false, confetti };
}

function memberName(m: NightMember) {
  return m.displayName || m.name || m.email.split("@")[0];
}

function timeLabel(minutes: number | null) {
  return minutes === null ? "Sin prisa" : formatDuration(minutes);
}

function playersLabel(game: NightGame) {
  if (!game.minPlayers && !game.maxPlayers) return null;
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers}p`
    : `${game.minPlayers || "?"}-${game.maxPlayers || "?"}p`;
}

function Chips({ game }: { game: NightGame }) {
  const players = playersLabel(game);
  const chip =
    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] whitespace-nowrap";
  return (
    <>
      {game.playingTime ? <span className={chip}>⏱ {formatDuration(game.playingTime)}</span> : null}
      {players && <span className={chip}>👥 {players}</span>}
      {game.weight ? <span className={chip}>⚖️ {game.weight.toFixed(1)}</span> : null}
    </>
  );
}

export default function GameNightModal({
  groupId,
  groupType,
  currentUserId,
  members,
  games,
  onPlayed,
  onClose,
}: Props) {
  // Tú primero, el resto por nombre
  const orderedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : memberName(a).localeCompare(memberName(b), "es")
      ),
    [members, currentUserId]
  );
  const nameById = useMemo(() => new Map(members.map((m) => [m.id, memberName(m)])), [members]);

  const [players, setPlayers] = useState<Set<string>>(() => new Set([currentUserId]));
  const [minutes, setMinutes] = useState<number | null>(DEFAULT_NIGHT_MINUTES);
  const [weight, setWeight] = useState<WeightId | null>(null);

  // Lo jugado esta noche: sale de la lista y descuenta su tiempo
  const [nightId, setNightId] = useState<string | null>(null);
  const [played, setPlayed] = useState<NightItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [state, setState] = useState<{ draw: Draw; tick: number } | null>(null);

  const spent = played.reduce((acc, item) => acc + (item.game.playingTime || 0), 0);
  const left = minutes === null ? null : Math.max(0, minutes - spent);
  const playerIds = useMemo(
    () => orderedMembers.filter((m) => players.has(m.id)).map((m) => m.id),
    [orderedMembers, players]
  );

  const { rows, out } = useMemo(() => {
    const playedIds = new Set(played.map((p) => p.groupGameId));
    return buildNight(
      games.filter((g) => !playedIds.has(g.groupGameId)),
      { players: playerIds, minutes: left, weight }
    );
  }, [games, played, playerIds, left, weight]);
  const pool = useMemo(() => nightPool(rows), [rows]);
  const inPool = useMemo(() => new Set(pool.map((r) => r.item.groupGameId)), [pool]);

  const draw = state?.draw ?? null;
  const tick = state?.tick ?? 0;

  // Cada tick mueve la ruleta un juego, con intervalos crecientes: va frenando.
  useEffect(() => {
    if (!draw || draw.instant) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (let i = 1; i <= TICKS; i++) {
      elapsed += 45 + 280 * Math.pow(i / TICKS, 3);
      timers.push(
        setTimeout(() => setState((s) => (s?.draw === draw ? { draw, tick: i } : s)), elapsed)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [draw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (state) setState(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, state]);

  const startDraw = () => {
    if (pool.length === 0) return;
    const next = newDraw(pool);
    setError("");
    setState({ draw: next, tick: next.instant ? TICKS : 0 });
  };

  const pickByHand = (row: Row) => {
    setError("");
    setState({
      draw: { pool: [row], start: 0, picked: 0, instant: true, manual: true, confetti: [] },
      tick: TICKS,
    });
  };

  const togglePlayer = (id: string) => {
    setPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else next.add(id);
      return next;
    });
  };

  const spinning = !!draw && tick < TICKS;
  const shown = draw
    ? draw.pool[spinning ? (draw.start + tick) % draw.pool.length : draw.picked]
    : null;
  const position = shown ? rows.findIndex((r) => r.item.groupGameId === shown.item.groupGameId) + 1 : 0;

  const playIt = async () => {
    if (!shown) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/nights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nightId, gameId: shown.item.game.id, playerIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo apuntar la partida");
      setNightId(data.id);
      setPlayed((prev) => [...prev, shown.item]);
      setState(null);
      setToast(`¡Apuntado! Que disfrutéis de ${shown.item.game.name} 🎉`);
      setTimeout(() => setToast(""), 4000);
      onPlayed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo apuntar la partida");
    } finally {
      setSaving(false);
    }
  };

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition-colors ${
      active
        ? "bg-[var(--accent-soft)] border-[var(--primary)] text-[var(--primary)]"
        : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
    }`;

  const outParts = [
    out.players > 0 && `${out.players} por jugadores`,
    out.time > 0 && `${out.time} por tiempo`,
    out.weight > 0 && `${out.weight} por peso`,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Confeti: se monta al revelar el ganador del sorteo y no captura clicks */}
      {draw && !spinning && !draw.manual && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {draw.confetti.map((p, i) => (
            <span
              key={i}
              className="absolute top-0 animate-confetti"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 1.6,
                background: p.color,
                borderRadius: p.round ? "9999px" : "2px",
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                ["--confetti-drift" as string]: `${p.drift}px`,
                ["--confetti-spin" as string]: `${p.spin}deg`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <h3 className="text-lg font-semibold text-[var(--text)]">🎲 ¡A jugar!</h3>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text)]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {draw && shown ? (
          // ── Ruleta / elegido ──
          <div className="px-5 pb-5 overflow-y-auto">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-4">
              {draw.manual
                ? "Elegido a dedo"
                : `Sorteo entre ${draw.pool.length === 1 ? "el único juego que encaja" : `los ${draw.pool.length} mejores para esta mesa`}`}
            </p>
            <div
              className={`rounded-2xl border p-4 min-h-[248px] flex flex-col items-center justify-center text-center transition-colors duration-500 ${
                spinning
                  ? "border-[var(--border)] bg-[var(--input-bg)]"
                  : "border-[var(--primary)]/50 bg-[var(--accent-soft)] animate-glow-pulse"
              }`}
              aria-live="polite"
            >
              <div
                key={spinning ? `spin-${shown.item.groupGameId}` : `winner-${shown.item.groupGameId}`}
                className={spinning ? "animate-reel-tick" : "animate-winner-pop"}
              >
                <div className="w-[104px] h-[104px] mx-auto rounded-xl overflow-hidden bg-[var(--surface-hover)]">
                  {shown.item.game.thumbnail ? (
                    <Image
                      src={shown.item.game.thumbnail}
                      alt={shown.item.game.name}
                      width={130}
                      height={130}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xl">🎲</div>
                  )}
                </div>
                <p className="mt-3 font-semibold text-[var(--text)] text-base sm:text-lg leading-tight">
                  {shown.item.game.name}
                  {shown.item.game.yearPublished && (
                    <span className="text-[var(--text-muted)] font-normal ml-1 text-xs">
                      ({shown.item.game.yearPublished})
                    </span>
                  )}
                </p>
                {spinning ? (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">Sorteando…</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                      {shown.item.game.bggRating && <BggRating rating={shown.item.game.bggRating} size={30} />}
                      <Chips game={shown.item.game} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--primary)]">
                      {draw.manual ? "👌 Buena elección" : "🎉 ¡Esta es vuestra partida!"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Puesto #{position} para esta mesa
                      {shown.votes.length > 0 && (
                        <> · {shown.votes.map((v) => findVoteOption(groupType, v.value)?.emoji ?? "").join(" ")}</>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-400 text-center">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={playIt}
                disabled={spinning || saving}
                className="flex-1 px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {saving ? "Apuntando…" : "✅ ¡Lo jugamos!"}
              </button>
              {!draw.manual && pool.length > 1 && (
                <button
                  onClick={startDraw}
                  disabled={spinning || saving}
                  className="px-4 py-2.5 rounded-xl border border-[var(--primary)]/40 text-[var(--primary)] hover:bg-[var(--accent-soft)] disabled:opacity-50 font-semibold text-sm transition-all duration-200"
                >
                  🎲 Otra vez
                </button>
              )}
              <button
                onClick={() => setState(null)}
                disabled={spinning || saving}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-50 font-semibold text-sm transition-all duration-200"
              >
                ← Lista
              </button>
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-muted)] text-center">
              «¡Lo jugamos!» lo marca como jugado y guarda la sesión con quién estaba.
            </p>
          </div>
        ) : (
          // ── Presentes, tiempo, peso y lista ──
          <>
            <div className="px-5 pb-4 overflow-y-auto flex-1 min-h-0">
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-4">
                Ordenamos los pendientes solo con los votos de quien está a la mesa.
              </p>

              {played.length > 0 && (
                <div className="mb-4 rounded-xl border border-[var(--primary)]/25 bg-[var(--accent-soft)] px-3 py-2.5 text-sm">
                  <p className="font-medium text-[var(--text)]">
                    En esta sesión: {played.map((p) => p.game.name).join(" · ")} ✓
                  </p>
                  {left !== null && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {left > 0 ? `Os queda ${formatDuration(left)}. ¿Otra?` : "Se os acabó el tiempo… ¿o no? 😏"}
                    </p>
                  )}
                </div>
              )}

              <section className="mb-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                  ¿Quién se sienta a la mesa? · {players.size}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {orderedMembers.map((m) => {
                    const active = players.has(m.id);
                    const name = m.id === currentUserId ? "Tú" : memberName(m);
                    return (
                      <button
                        key={m.id}
                        onClick={() => togglePlayer(m.id)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border text-xs sm:text-sm font-medium transition-colors ${
                          active
                            ? "bg-[var(--accent-soft)] border-[var(--primary)] text-[var(--primary)]"
                            : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] opacity-70"
                        }`}
                      >
                        <Avatar name={memberName(m)} avatarUrl={m.avatarUrl} size="xs" />
                        {name}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mb-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                  ¿Cuánto tiempo hay?
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {NIGHT_TIMES.map((t) => (
                    <button key={t ?? "free"} onClick={() => setMinutes(t)} className={pill(minutes === t)} aria-pressed={minutes === t}>
                      {t === null ? "♾️ Sin prisa" : timeLabel(t)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mb-5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                  ¿Con cuánto peso?
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setWeight(null)} className={pill(weight === null)} aria-pressed={weight === null}>
                    Me da igual
                  </button>
                  {NIGHT_WEIGHTS.map((w) => (
                    <button key={w.id} onClick={() => setWeight(w.id)} className={pill(weight === w.id)} aria-pressed={weight === w.id}>
                      {w.emoji} {w.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-[var(--text)]">
                  {rows.length === 0
                    ? "Nada encaja"
                    : `${rows.length} ${rows.length === 1 ? "juego encaja" : "juegos encajan"}`}
                </h4>
                {outParts.length > 0 && (
                  <span className="text-[11px] text-[var(--text-muted)] text-right">Fuera: {outParts.join(", ")}</span>
                )}
              </div>

              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-secondary)] text-center">
                  Con {players.size} {players.size === 1 ? "jugador" : "jugadores"}
                  {left !== null && ` y ${formatDuration(left)}`} no hay nada pendiente que encaje.
                  {" "}Prueba con más tiempo{weight ? " o sin filtro de peso" : ""}.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {rows.map((row, i) => {
                    const pooled = inPool.has(row.item.groupGameId);
                    return (
                      <li key={row.item.groupGameId}>
                        <button
                          onClick={() => pickByHand(row)}
                          className={`w-full flex items-center gap-2.5 rounded-xl border p-2 text-left transition-colors hover:bg-[var(--surface-hover)] ${
                            pooled ? "border-[var(--primary)]/35" : "border-[var(--border)]"
                          }`}
                        >
                          <span className={`w-6 text-center text-xs font-bold shrink-0 ${pooled ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}>
                            {i + 1}
                          </span>
                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-[var(--surface-hover)] shrink-0">
                            {row.item.game.thumbnail ? (
                              <Image src={row.item.game.thumbnail} alt="" width={44} height={44} className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sm">🎲</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--text)] truncate">{row.item.game.name}</p>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              <Chips game={row.item.game} />
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-0.5">
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                row.score > 0 ? "text-[var(--primary)]" : row.score < 0 ? "text-red-400" : "text-[var(--text-muted)]"
                              }`}
                            >
                              {row.score > 0 ? `+${row.score}` : row.score}
                            </span>
                            {row.votes.length > 0 && (
                              <span
                                className="text-xs leading-none"
                                title={row.votes
                                  .map((v) => `${nameById.get(v.userId) ?? "Alguien"}: ${findVoteOption(groupType, v.value)?.label ?? v.value}`)
                                  .join(" · ")}
                              >
                                {row.votes.map((v) => findVoteOption(groupType, v.value)?.emoji ?? "").join("")}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border)]">
              <button
                onClick={startDraw}
                disabled={pool.length === 0}
                className="w-full px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {pool.length <= 1 ? "🎲 Sortear" : `🎲 Sortear entre los ${pool.length} mejores`}
              </button>
              <p className="mt-2 text-[11px] text-[var(--text-muted)] text-center">
                ¿Lo tenéis claro? Toca un juego y elegidlo a dedo.
              </p>
            </div>
          </>
        )}

        {toast && (
          <div className="fx-toast-in fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--primary)] text-[var(--primary-text)] px-4 py-3 rounded-xl shadow-lg font-semibold text-sm">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
