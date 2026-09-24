"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Avatar from "@/components/Avatar";
import BggRating from "@/components/BggRating";
import GameShelf, { type ShelfGame } from "@/components/GameShelf";
import { KEEP_CLASSES, KEEP_EMOJI, KEEP_LABELS, KEEP_SCORES } from "@/lib/collection";
import { DEMO_GAMES, type DemoGame } from "./games";
import { usePrefersReducedMotion } from "@/components/motion";

// Mockups de la portada: versiones de juguete de las pantallas de verdad,
// con datos inventados y el mismo aspecto que dentro de la app. Los que se
// mueven solo lo hacen mientras están a la vista (`active`).

const G = DEMO_GAMES;

// ── Piezas comunes ──────────────────────────────────────────────────────

export function Thumb({ game, className = "w-10 h-10" }: { game: DemoGame; className?: string }) {
  return (
    <div className={`${className} rounded-lg overflow-hidden bg-[var(--surface-hover)] shrink-0`}>
      <Image src={game.thumb} alt="" width={80} height={80} unoptimized className="w-full h-full object-cover" />
    </div>
  );
}

/** Marco de ventana de la app, con su barra y la dirección. */
export function AppWindow({
  path,
  children,
  className = "",
}: {
  path: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35)] overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--surface-alt)]">
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="flex-1 min-w-0 mx-2 px-3 py-1 rounded-lg bg-[var(--bg)] text-[11px] text-[var(--text-muted)] font-mono truncate">
          bgplanner.app{path}
        </span>
      </div>
      {children}
    </div>
  );
}

const AVATAR_STACK = ["Ana", "Luis", "Marta", "Dani", "Sofía", "Iker"];

export function AvatarStack({ names = AVATAR_STACK, extra }: { names?: string[]; extra?: number }) {
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {names.map((n) => (
          <Avatar key={n} name={n} size="xs" className="ring-2 ring-[var(--surface)]" />
        ))}
      </div>
      {extra ? (
        <span className="ml-2 text-xs font-semibold text-[var(--text-secondary)]">+{extra}</span>
      ) : null}
    </div>
  );
}

/** Repite `fn` cada `ms` mientras `active` sea true. */
function useTicker(active: boolean, ms: number, fn: () => void) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => fnRef.current(), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

// ── Ranking en vivo (portada) ───────────────────────────────────────────

interface LiveRow {
  key: string;
  game: DemoGame;
  score: number;
}

interface VoteFlash {
  id: number;
  key: string;
  label: string;
  tone: "up" | "super" | "down";
}

const LIVE_START: LiveRow[] = [
  { key: "brass", game: G.brass, score: 11 },
  { key: "root", game: G.root, score: 10 },
  { key: "arkNova", game: G.arkNova, score: 8 },
  { key: "wyrmspan", game: G.wyrmspan, score: 6 },
  { key: "viticulture", game: G.viticulture, score: 5 },
];

const VOTERS = ["Ana", "Luis", "Marta", "Dani", "Sofía"];
const ROW_H = 60;

export function LiveRanking({ active = true }: { active?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [rows, setRows] = useState(LIVE_START);
  const [flash, setFlash] = useState<VoteFlash | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const counter = useRef(0);

  const order = useMemo(
    () => [...rows].sort((a, b) => b.score - a.score || b.game.rating - a.game.rating),
    [rows]
  );

  useTicker(active && !reduced, 2300, () => {
    counter.current += 1;
    const byScore = (list: LiveRow[]) =>
      [...list].sort((a, b) => b.score - a.score || b.game.rating - a.game.rating);
    const sorted = byScore(rows);
    // Casi siempre votan a los de abajo, para que haya adelantamientos.
    const pool = Math.random() < 0.75 ? sorted.slice(1) : sorted;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const r = Math.random();
    const leaderTooFar = target.key === sorted[0].key && sorted[0].score - sorted[1].score > 3;
    const tone: VoteFlash["tone"] = leaderTooFar || r < 0.12 ? "down" : r < 0.3 ? "super" : "up";
    const delta = tone === "super" ? 3 : tone === "down" ? -1 : 1;
    const voter = VOTERS[Math.floor(Math.random() * VOTERS.length)];
    const label = tone === "super" ? `+3 ⭐ ${voter}` : tone === "down" ? `−1 👎 ${voter}` : `+1 👍 ${voter}`;

    let next = rows.map((x) => (x.key === target.key ? { ...x, score: x.score + delta } : x));
    // Que no se dispare: al pasar de 30 volvemos al principio.
    if (next.some((x) => x.score > 30)) next = LIVE_START;
    const oldRank = sorted.findIndex((x) => x.key === target.key);
    const newRank = byScore(next).findIndex((x) => x.key === target.key);

    setRows(next);
    setFlash({ id: counter.current, key: target.key, label, tone });
    setMoved(newRank < oldRank ? target.key : null);
  });

  return (
    <div className="relative" style={{ height: ROW_H * LIVE_START.length }}>
      {order.map((row, i) => {
        const medal = ["🥇", "🥈", "🥉"][i];
        const isFlash = flash?.key === row.key;
        return (
          <div
            key={row.key}
            className="absolute inset-x-0 px-3 sm:px-4 transition-transform duration-700 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
            style={{ transform: `translateY(${i * ROW_H}px)`, height: ROW_H }}
          >
            <div
              className={`h-[52px] flex items-center gap-3 rounded-xl px-2.5 border transition-colors duration-500 ${
                isFlash
                  ? flash.tone === "down"
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-[var(--primary)]/40 bg-[var(--accent-soft)]"
                  : "border-transparent"
              }`}
            >
              <span className="w-6 text-center text-lg leading-none shrink-0">
                {medal ?? <span className="text-sm font-bold text-[var(--text-muted)]">{i + 1}</span>}
              </span>
              <Thumb game={row.game} className="w-9 h-9" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text)] truncate flex items-center gap-1.5">
                  {row.game.name}
                  {moved === row.key && (
                    <span key={flash?.id} className="fx-pop text-[10px] font-bold text-emerald-500">▲</span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  👥 {row.game.players} · ⏱ {row.game.minutes} min
                </div>
              </div>
              <div className="relative shrink-0">
                {isFlash && (
                  <span
                    key={flash.id}
                    className={`fx-chip-rise absolute right-0 -top-5 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      flash.tone === "super"
                        ? "bg-orange-500 text-white"
                        : flash.tone === "down"
                          ? "bg-red-500 text-white"
                          : "bg-[var(--primary)] text-[var(--primary-text)]"
                    }`}
                  >
                    {flash.label}
                  </span>
                )}
                <span className="inline-flex items-baseline gap-0.5 px-2 py-1 rounded-lg bg-[var(--surface-alt)] text-sm font-bold text-[var(--text)] tabular-nums">
                  {row.score}
                  <span className="text-[10px] font-medium text-[var(--text-muted)]">pts</span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Paso 1: montad el grupo ─────────────────────────────────────────────

const MEMBERS = [
  { name: "Ana", games: 132 },
  { name: "Luis", games: 84 },
  { name: "Marta", games: 47 },
  { name: "Dani", games: 21 },
];

export function GroupSetupMock({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [joinedState, setJoined] = useState(0);
  const [totalState, setTotal] = useState(0);

  useEffect(() => {
    if (!active || reduced) return;
    // Cada vez que vuelve a la vista, los miembros entran otra vez uno a uno.
    const timers = [
      setTimeout(() => setJoined(0), 0),
      ...MEMBERS.map((_, i) => setTimeout(() => setJoined(i + 1), 500 + i * 750)),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active, reduced]);

  const joined = reduced ? MEMBERS.length : joinedState;
  // El contador sube hasta la suma de las colecciones de quien ya ha entrado
  // (sin duplicados: algunos juegos los tienen varios).
  const target = Math.round(MEMBERS.slice(0, joined).reduce((s, m) => s + m.games, 0) * 0.86);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const step = () => {
      setTotal((t) => {
        if (t === target) return t;
        const diff = target - t;
        return t + Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) / 8));
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  const total = reduced ? target : totalState;

  return (
    <AppWindow path="/groups/los-del-jueves">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold font-[family-name:var(--font-display)] text-[var(--text)]">
              Los del jueves 🎲
            </div>
            <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
              👥 Con amigos
            </span>
          </div>
          <span className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] font-mono">
            🔗 Invitar
          </span>
        </div>

        <ul className="space-y-2">
          {MEMBERS.map((m, i) => {
            const here = i < joined;
            return (
              <li
                key={m.name}
                className={`flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 transition-all duration-500 ${
                  here ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                }`}
              >
                <Avatar name={m.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">{m.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Colección de BGG importada</div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ✓ {m.games} juegos
                </span>
              </li>
            );
          })}
        </ul>

        <div className="rounded-xl bg-[var(--surface-alt)] p-3 flex items-center gap-3">
          <div className="flex -space-x-3">
            {[G.brass, G.root, G.arkNova, G.dune, G.wyrmspan].map((g) => (
              <Thumb key={g.bggId} game={g} className="w-9 h-9 ring-2 ring-[var(--surface-alt)]" />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-extrabold tabular-nums text-[var(--text)] leading-none">{total}</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">juegos en la mesa entre todos</div>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

// ── Paso 2: votad ───────────────────────────────────────────────────────

export function VoteMock({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  // 0 sin voto · 1 👍 · 2 ⭐ · 3-4 ⭐ + comentario
  const [phaseState, setPhase] = useState(0);
  const [typedState, setTyped] = useState(0);
  const comment = "Con 4 jugadores es otro juego 🔥";

  useTicker(active && !reduced, 1500, () => {
    const next = (phaseState + 1) % 5;
    setPhase(next);
    if (next < 3) setTyped(0);
  });

  useEffect(() => {
    if (phaseState < 3 || reduced) return;
    const id = setInterval(() => setTyped((t) => Math.min(comment.length, t + 2)), 45);
    return () => clearInterval(id);
  }, [phaseState, reduced]);

  const phase = reduced ? 3 : phaseState;
  const typed = reduced ? comment.length : typedState;
  const vote = phase === 0 ? null : phase === 1 ? "up" : "super";
  const score = vote === "super" ? 14 : vote === "up" ? 12 : 11;

  const btn = (kind: "down" | "up" | "super", emoji: string, label: string) => {
    const on = vote === kind;
    const onClass =
      kind === "super"
        ? "bg-orange-500/20 border-orange-500 text-orange-500 animate-glow-pulse"
        : kind === "down"
          ? "bg-red-500/20 border-red-500 text-red-400"
          : "bg-[var(--accent-soft)] border-[var(--primary)] text-[var(--primary)]";
    return (
      <div className="flex flex-col items-center gap-1">
        <span
          className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center text-xl transition-all duration-300 ${
            on ? `${onClass} scale-110` : "border-[var(--border)] grayscale-[0.4]"
          }`}
        >
          {emoji}
        </span>
        <span className={`text-[10px] font-medium ${on ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{label}</span>
      </div>
    );
  };

  return (
    <AppWindow path="/groups/los-del-jueves?tab=ranking">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ranking</span>
          <span
            className={`px-2 py-1 rounded-lg border transition-colors duration-300 ${
              vote === "super"
                ? "border-orange-500/40 text-orange-500 bg-orange-500/10"
                : "border-[var(--border)] text-[var(--text-secondary)]"
            }`}
          >
            {vote === "super" ? "⭐ Supervoto usado" : "⭐ Te queda 1 supervoto"}
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--border)] p-3.5">
          <div className="flex gap-3">
            <Thumb game={G.brass} className="w-16 h-16" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[var(--text)] leading-tight">{G.brass.name}</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                👥 {G.brass.players} · ⏱ {G.brass.minutes} min · Pesado
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums text-[var(--text)] transition-all">{score} pts</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 transition-opacity duration-300 ${
                    vote ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {vote === "super" ? "↑ sube al 1º" : "↑ sube al 2º"}
                </span>
              </div>
            </div>
            <BggRating rating={G.brass.rating} size={30} />
          </div>

          <div className="mt-4 flex items-end justify-center gap-5">
            {btn("down", "👎", "No")}
            {btn("up", "👍", "Me apetece")}
            {btn("super", "⭐", "Supervoto")}
          </div>
        </div>

        <div
          className={`flex gap-2 items-start transition-all duration-500 ${
            phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          <Avatar name="Tú" size="sm" />
          <div className="rounded-2xl rounded-tl-md bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)] min-h-[36px]">
            {comment.slice(0, typed)}
            <span className="landing-caret" />
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

// ── Paso 3: el podio ────────────────────────────────────────────────────

export function PodiumMock({ active }: { active: boolean }) {
  const podium = [
    { rank: 2, game: G.root, pts: 12, h: "h-16", gradient: "from-slate-200 via-slate-400 to-slate-500", ring: "ring-slate-400/60" },
    { rank: 1, game: G.brass, pts: 14, h: "h-24", gradient: "from-amber-300 via-yellow-400 to-amber-600", ring: "ring-yellow-400/60" },
    { rank: 3, game: G.arkNova, pts: 9, h: "h-11", gradient: "from-amber-600 via-amber-700 to-amber-900", ring: "ring-amber-700/60" },
  ];
  const votes = [
    { who: "Ana", v: "⭐" },
    { who: "Luis", v: "👍" },
    { who: "Marta", v: "👍" },
    { who: "Dani", v: "👎" },
    { who: "Tú", v: "⭐" },
  ];
  return (
    <AppWindow path="/groups/los-del-jueves">
      <div className="p-4 sm:p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-4">
          🏆 Podio del grupo
        </div>
        <div className="grid grid-cols-3 gap-3 items-end">
          {podium.map((p, i) => (
            <div key={p.rank} className="flex flex-col items-center text-center min-w-0">
              <span className={`h-7 text-2xl leading-none ${p.rank === 1 && active ? "fx-crown" : ""}`} aria-hidden>
                {p.rank === 1 ? "👑" : ""}
              </span>
              <Thumb
                game={p.game}
                className={`${p.rank === 1 ? "w-16 h-16 sm:w-20 sm:h-20" : "w-12 h-12 sm:w-16 sm:h-16"} ring-2 ${p.ring} mb-2`}
              />
              <div className="text-xs sm:text-sm font-semibold text-[var(--text)] leading-tight line-clamp-2">{p.game.name}</div>
              <div className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-0.5 mb-2">{p.pts} pts</div>
              <div
                className={`w-full ${p.h} rounded-t-xl bg-gradient-to-b ${p.gradient} flex items-start justify-center pt-1.5 origin-bottom transition-transform duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)]`}
                style={{ transform: active ? "scaleY(1)" : "scaleY(0.05)", transitionDelay: `${[250, 0, 500][i]}ms` }}
              >
                <span className="text-white text-lg font-bold drop-shadow">{p.rank}º</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
          <div className="text-[11px] text-[var(--text-muted)] mb-2">Quién votó a {G.brass.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {votes.map((v, i) => (
              <span
                key={v.who}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[var(--surface-alt)] text-[var(--text-secondary)] transition-all duration-500 ${
                  active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                }`}
                style={{ transitionDelay: `${700 + i * 90}ms` }}
              >
                {v.v} {v.who}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

// ── Paso 4: a la mesa (sorteo) ──────────────────────────────────────────

const REEL = [G.brass, G.root, G.arkNova, G.wyrmspan, G.viticulture, G.dune, G.arnak];
const CONFETTI_COLORS = ["#f59e0b", "#fbbf24", "#34d399", "#60a5fa", "#c084fc", "#f87171"];

export function PickMock({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [idx, setIdx] = useState(1);
  const [done, setDone] = useState(true);
  const [round, setRound] = useState(0);

  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: Math.random() * 100,
        size: 5 + Math.random() * 5,
        delay: Math.random() * 0.3,
        duration: 1.4 + Math.random() * 0.9,
        drift: (Math.random() - 0.5) * 120,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    // Un confeti nuevo en cada tirada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round]
  );

  useEffect(() => {
    if (!active || reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const spin = () => {
      setDone(false);
      const winner = Math.floor(Math.random() * REEL.length);
      const ticks = 16;
      let t = 0;
      let elapsed = 0;
      for (let k = 0; k < ticks; k++) {
        // Cada vez más lento, como una ruleta de verdad.
        elapsed += 60 + k * k * 1.6;
        const at = elapsed;
        const value = k === ticks - 1 ? winner : (winner + ticks - k) % REEL.length;
        timers.push(setTimeout(() => setIdx(value), at));
        t = at;
      }
      timers.push(
        setTimeout(() => {
          setDone(true);
          setRound((r) => r + 1);
        }, t + 80)
      );
      timers.push(setTimeout(spin, t + 3400));
    };
    timers.push(setTimeout(spin, 400));
    return () => timers.forEach(clearTimeout);
  }, [active, reduced]);

  const game = REEL[idx];
  return (
    <AppWindow path="/groups/los-del-jueves?tab=ranking">
      <div className="relative p-4 sm:p-5 overflow-hidden">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {["👥 4 jugadores", "⏱ Unas 2 horas", "🏆 Top del ranking"].map((c) => (
            <span key={c} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-secondary)] bg-[var(--surface-alt)]">
              {c}
            </span>
          ))}
        </div>

        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">
            🎲 Ayúdame a elegir
          </div>
          <div
            className={`mx-auto w-full max-w-[260px] rounded-2xl border-2 p-4 transition-colors duration-300 ${
              done ? "border-[var(--primary)] animate-glow-pulse" : "border-[var(--border)]"
            }`}
          >
            <div key={`${idx}-${done}`} className={done ? "animate-winner-pop" : "animate-reel-tick"}>
              <Thumb game={game} className="w-20 h-20 mx-auto" />
              <div className="mt-2 font-bold text-[var(--text)] leading-tight">{game.name}</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                👥 {game.players} · ⏱ {game.minutes} min
              </div>
            </div>
          </div>
          <div className={`mt-3 text-sm font-bold text-[var(--primary)] h-5 transition-opacity ${done ? "opacity-100" : "opacity-0"}`}>
            ¡A la mesa! 🎉
          </div>
        </div>

        {done && active && !reduced && (
          <div key={round} className="pointer-events-none absolute inset-0" aria-hidden>
            {confetti.map((c, i) => (
              <span
                key={i}
                className="absolute top-0 animate-confetti"
                style={
                  {
                    left: `${c.left}%`,
                    width: c.size,
                    height: c.round ? c.size : c.size * 0.45,
                    background: c.color,
                    borderRadius: c.round ? "999px" : "2px",
                    animationDelay: `${c.delay}s`,
                    animationDuration: `${c.duration}s`,
                    "--confetti-drift": `${c.drift}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>
    </AppWindow>
  );
}

// ── Mi colección ────────────────────────────────────────────────────────

const SHELF_START: (ShelfGame & { demo: DemoGame })[] = [
  G.brass, G.root, G.wyrmspan, G.arkNova, G.viticulture, G.odin, G.gaia, G.lorenzo,
].map((g, i) => ({
  bggId: g.bggId,
  name: g.name,
  image: null,
  thumbnail: g.thumb,
  keepScore: [5, 5, 4, null, 3, 4, 2, 1][i],
  showcased: i === 0 || i === 1,
  demo: g,
}));

export function CollectionMock() {
  const [games, setGames] = useState(SHELF_START);
  const [selected, setSelected] = useState<number>(G.arkNova.bggId);
  const current = games.find((g) => g.bggId === selected)!;
  const unrated = games.filter((g) => !g.keepScore).length;

  const rate = (score: number) =>
    setGames((prev) => prev.map((g) => (g.bggId === selected ? { ...g, keepScore: score } : g)));

  return (
    <AppWindow path="/collection?view=shelf">
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex gap-1.5 text-[11px] sm:text-xs overflow-x-auto no-scrollbar">
          <span className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-text)] font-semibold">Los que tengo · 124</span>
          <span className="shrink-0 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)]">Los que quiero · 18</span>
          <span className="shrink-0 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] tabular-nums">
            Sin valorar · {unrated}
          </span>
        </div>

        <div className="landing-shelf">
          <GameShelf games={games} onSelect={(g) => setSelected(g.bggId)} compact />
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <Thumb game={current.demo} className="w-9 h-9" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)] truncate">¿Se queda {current.name}?</div>
              <div className="text-[11px] text-[var(--text-muted)]">Toca una caja de la estantería y puntúala 👆</div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {KEEP_SCORES.map((s) => {
              const on = current.keepScore === s;
              return (
                <button
                  key={s}
                  onClick={() => rate(s)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-all ${
                    on ? `${KEEP_CLASSES[s]} scale-105` : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                  }`}
                  title={KEEP_LABELS[s]}
                >
                  <span className="text-base leading-none">{KEEP_EMOJI[s]}</span>
                  <span className="text-[9px] sm:text-[10px] leading-tight text-center">{KEEP_LABELS[s]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

// ── Eventos ─────────────────────────────────────────────────────────────

const INTENSITY: Record<number, { label: string; cls: string }> = {
  5: { label: "Máxima prioridad", cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500" },
  4: { label: "Tengo que probarlo", cls: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500" },
  3: { label: "Me encantaría", cls: "bg-[var(--accent-soft)] text-[var(--primary)] border-[var(--primary)]" },
  2: { label: "Si surge, me va bien", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500" },
  1: { label: "Solo si no queda otra", cls: "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)]" },
};

const EVENT_GAMES = [
  { game: G.dune, mine: 5, people: 14 },
  { game: G.seti, mine: 4, people: 9 },
  { game: G.altaTension, mine: 2, people: 6 },
];

export function EventMock({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [levels, setLevels] = useState(EVENT_GAMES.map((g) => g.mine));
  const [step, setStep] = useState(0);

  // De vez en cuando «alguien» cambia de idea en el segundo juego.
  useTicker(active && !reduced, 1800, () => {
    setStep((s) => s + 1);
    setLevels((prev) => prev.map((l, i) => (i === 1 ? [4, 5, 3, 4][(step + 1) % 4] : l)));
  });

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35)]">
        <div className="relative h-36 sm:h-40 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 fx-event-art">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <span className="absolute top-3 left-3 text-[11px] font-semibold px-2 py-1 rounded-full bg-white/90 text-violet-700">
            🌍 Evento abierto
          </span>
          <div className="absolute top-3 right-3 w-14 rounded-xl bg-white text-center overflow-hidden shadow-lg">
            <div className="bg-rose-500 text-white text-[10px] font-bold py-0.5">SÁB</div>
            <div className="text-xl font-extrabold text-slate-900 leading-tight">18</div>
            <div className="text-[10px] font-semibold text-slate-500 pb-1">OCT</div>
          </div>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="text-xl sm:text-2xl font-extrabold font-[family-name:var(--font-display)] leading-tight drop-shadow">
              Jornadas lúdicas de otoño
            </div>
            <div className="text-xs opacity-90 mt-0.5">📍 Centro cívico · 10:00 a 21:00</div>
          </div>
        </div>
        <div className="bg-[var(--surface)] p-3.5 flex items-center justify-between gap-3">
          <div>
            <AvatarStack extra={23} />
            <div className="text-[11px] text-[var(--text-muted)] mt-1">29 apuntados · 11 plazas libres</div>
          </div>
          <span className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">
            ✓ Voy
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 space-y-3 shadow-[var(--card-shadow)]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">¿Qué quieres jugar allí?</div>
        {EVENT_GAMES.map((eg, i) => {
          const level = levels[i];
          return (
            <div key={eg.game.bggId} className="flex items-center gap-3">
              <Thumb game={eg.game} className="w-10 h-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text)] truncate">{eg.game.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0">{eg.people} interesados</span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <span
                      key={l}
                      className={`w-6 h-6 rounded-md border text-[11px] font-bold flex items-center justify-center transition-all duration-300 ${
                        l === level ? `${INTENSITY[l].cls} scale-110` : "border-[var(--border)] text-[var(--text-muted)]"
                      }`}
                    >
                      {l}
                    </span>
                  ))}
                  <span key={level} className="ml-2.5 text-[11px] text-[var(--text-secondary)] truncate fx-pop">
                    {INTENSITY[level].label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Miniaturas para el «y además» ───────────────────────────────────────

const BADGE_TIERS = [
  { emoji: "🎲", name: "Coleccionista", tier: "from-slate-200 to-slate-400" },
  { emoji: "👥", name: "Alma del grupo", tier: "from-amber-300 to-yellow-500" },
  { emoji: "🎪", name: "Asiduo", tier: "from-amber-600 to-amber-800" },
  { emoji: "🗳️", name: "Voto de oro", tier: "from-amber-300 to-yellow-500" },
];

export function BadgesMini() {
  return (
    <div className="flex gap-2">
      {BADGE_TIERS.map((b, i) => (
        <div key={b.name} className="flex flex-col items-center gap-1 min-w-0 flex-1">
          <span
            className={`fx-shine relative w-11 h-11 rounded-full bg-gradient-to-br ${b.tier} flex items-center justify-center text-xl shadow-md overflow-hidden`}
            style={{ animationDelay: `${i * 0.6}s` }}
          >
            {b.emoji}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] text-center leading-tight">{b.name}</span>
        </div>
      ))}
    </div>
  );
}

export function GalleryMini() {
  const tiles = [G.root, G.wyrmspan, G.odin, G.dune];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {tiles.map((g, i) => (
        <div key={g.bggId} className="relative aspect-square rounded-lg overflow-hidden">
          <Image src={g.thumb} alt="" fill unoptimized sizes="80px" className="object-cover" />
          {i === 0 && (
            <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/55 text-amber-300 py-0.5">★★★★★</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function PingMini() {
  return (
    <div className="rounded-xl bg-[#0f172a] border border-[#334155] p-3 text-left">
      <div className="text-[10px] text-[#94a3b8]">BG Planner · ahora</div>
      <div className="text-sm font-semibold text-[#f1f5f9] mt-0.5">Ana os convoca: ¿jugamos el viernes? 🎲</div>
      <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#f59e0b] text-[#0f172a]">Ir a votar</span>
    </div>
  );
}

export function CoupleMini() {
  return (
    <div className="flex items-center justify-between gap-1">
      {[-1, 0, 1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`flex-1 h-8 rounded-lg border text-xs font-bold flex items-center justify-center ${
            n === 4
              ? "bg-pink-500/15 border-pink-500 text-pink-500 scale-110 shadow-md shadow-pink-500/20"
              : "border-[var(--border)] text-[var(--text-muted)]"
          }`}
        >
          {n > 0 ? `+${n}` : n}
        </span>
      ))}
    </div>
  );
}

export function ShareMini() {
  return (
    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
      <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-white dark:bg-emerald-900/70 shadow-sm overflow-hidden text-left">
        <div className="flex gap-1 items-end justify-center px-2 pt-2 pb-1 bg-gradient-to-b from-[#c9a882] to-[#b8956b] dark:from-[#4a382c] dark:to-[#33261d] border-b-4 border-[#8a5a33] dark:border-[#5c3d24]">
          {[G.brass, G.root, G.wyrmspan, G.odin].map((g) => (
            <Image key={g.bggId} src={g.thumb} alt="" width={36} height={36} unoptimized className="h-9 w-auto rounded-sm shadow" />
          ))}
        </div>
        <div className="px-2.5 py-1.5">
          <div className="text-[11px] font-semibold text-slate-900 dark:text-emerald-50 leading-tight">La colección de juegos de Ana</div>
          <div className="text-[10px] text-slate-500 dark:text-emerald-200/70">124 juegos · bgplanner.app</div>
        </div>
      </div>
    </div>
  );
}

export function RoadmapMini() {
  const ideas = [
    { t: "Modo torneo", v: 42 },
    { t: "Préstamos de juegos", v: 31 },
  ];
  return (
    <div className="space-y-1.5">
      {ideas.map((i) => (
        <div key={i.t} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5">
          <span className="flex flex-col items-center text-[10px] font-bold text-[var(--primary)] leading-none">
            ▲<span className="tabular-nums">{i.v}</span>
          </span>
          <span className="text-xs text-[var(--text-secondary)] truncate">{i.t}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tarjetas flotantes del hero ─────────────────────────────────────────

export function EventTicketMini() {
  return (
    <div className="w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.35)] overflow-hidden">
      <div className="h-14 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 fx-event-art relative">
        <span className="absolute bottom-1.5 left-3 text-white text-sm font-bold drop-shadow">Jornadas de otoño</span>
      </div>
      <div className="p-3">
        <div className="text-[11px] text-[var(--text-muted)]">📅 Sáb 18 oct · 📍 Centro cívico</div>
        <div className="mt-2 flex items-center justify-between">
          <AvatarStack names={["Ana", "Luis", "Marta", "Dani"]} extra={25} />
        </div>
      </div>
    </div>
  );
}

export function WinnerMini() {
  return (
    <div className="w-48 rounded-2xl border-2 border-[var(--primary)] bg-[var(--surface)] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.35)] p-3 text-center animate-glow-pulse">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">🎲 Ayúdame a elegir</div>
      <Thumb game={G.root} className="w-14 h-14 mx-auto mt-2" />
      <div className="mt-1.5 text-sm font-bold text-[var(--text)]">¡Sale Root!</div>
    </div>
  );
}

export function ToastMini() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.35)] px-3 py-2.5">
      <Avatar name="Marta" size="sm" />
      <div className="text-xs leading-snug">
        <div className="font-semibold text-[var(--text)]">Marta se apunta al jueves</div>
        <div className="text-[var(--text-muted)]">y pone su ⭐ en Brass</div>
      </div>
    </div>
  );
}
