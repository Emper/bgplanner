"use client";

import { useState } from "react";
import Image from "next/image";
import Avatar from "@/components/Avatar";
import { INTENSITY_COLORS, INTENSITY_LABELS } from "@/lib/intensity";
import { buildMesa, type MesaGameInput, type MesaMood, type MesaRow } from "@/lib/mesa";

// "Armar mesa": qué jugar con un grupo concreto de asistentes. El cálculo
// vive en lib/mesa.ts; aquí solo se pinta.

export interface MesaMember {
  id: string; // id de asistente
  user: { name: string | null; displayName: string | null; avatarUrl: string | null };
}

type MesaGame = MesaGameInput & {
  game: MesaGameInput["game"] & { thumbnail: string | null };
};

const MOODS: Record<Exclude<MesaMood, null>, { label: string; cls: string }> = {
  fire: { label: "🔥 Todos a tope", cls: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/50" },
  consensus: { label: "🤝 Consenso", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/50" },
  split: { label: "⚖️ Dividido", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/50" },
};

function fullName(m: MesaMember) {
  return m.user.displayName || m.user.name || "Jugador";
}

/** "Tú, Alex y Nuria" */
function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export default function MesaView({
  members,
  games,
  currentAttendeeId,
  shareUrl,
  onClose,
}: {
  members: MesaMember[];
  games: MesaGame[];
  currentAttendeeId: string | null;
  shareUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const memberIds = members.map((m) => m.id);
  const nameOf = (id: string) => {
    if (id === currentAttendeeId) return "Tú";
    const m = members.find((x) => x.id === id);
    return m ? fullName(m).split(" ")[0] : "Alguien";
  };
  const { all, almost, played } = buildMesa(games, memberIds);
  // Quien no ha marcado nada no es que no quiera: es que aún no ha votado
  const silent = memberIds.filter((id) => !games.some((eg) => eg.interests.some((i) => i.attendeeId === id)));

  const playedText = (ids: string[]) => {
    const me = ids.includes(currentAttendeeId ?? "");
    const others = ids.filter((id) => id !== currentAttendeeId).map(nameOf);
    if (me && others.length === 0) return "Ya lo has jugado";
    if (me) return `Ya lo habéis jugado tú y ${joinNames(others)}`;
    return `Ya lo ${others.length === 1 ? "ha" : "han"} jugado ${joinNames(others)}`;
  };

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const renderRow = (row: MesaRow<MesaGame>, rank: number | null, kind: "all" | "almost" | "played") => {
    const { game } = row.eventGame;
    const dim = kind === "played";
    return (
      <li key={row.eventGame.id} className="flex items-center gap-3 py-2.5">
        {rank !== null && (
          <span className="w-5 shrink-0 text-right text-sm font-bold text-[var(--text-muted)] tabular-nums">{rank}</span>
        )}
        <div className={`w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-[var(--surface-hover)] ${dim ? "opacity-60" : ""}`}>
          {game.thumbnail ? (
            <Image src={game.thumbnail} alt={game.name} width={40} height={40} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">?</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
            <span className={`font-semibold text-sm sm:text-base ${dim ? "text-[var(--text-secondary)]" : "text-[var(--text)]"}`}>
              {game.name}
            </span>
            {row.mood && (
              <span className={`inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium border ${MOODS[row.mood].cls}`}>
                {MOODS[row.mood].label}
              </span>
            )}
            {row.playersWarning && (
              <span className="inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300">
                ⚠ {row.playersWarning}
              </span>
            )}
          </div>
          {kind === "almost" && row.missing.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {silent.includes(row.missing[0])
                ? `Falta ${row.missing[0] === currentAttendeeId ? "tu voto" : `el voto de ${nameOf(row.missing[0])}`}`
                : row.missing[0] === currentAttendeeId
                  ? "A ti no te llama"
                  : `A ${nameOf(row.missing[0])} no le llama`}
            </p>
          )}
          {kind === "played" && <p className="text-xs text-[var(--text-muted)] mt-0.5">{playedText(row.playedBy)}</p>}
        </div>
        {/* Las ganas de cada uno, en el orden de la mesa */}
        <div className="flex items-center gap-1 shrink-0">
          {members.map((m, i) => {
            const value = row.intensities[i];
            return (
              <div key={m.id} className={`relative ${value === null ? "opacity-30" : ""}`} title={`${fullName(m)}: ${value ? INTENSITY_LABELS[value] : "no lo ha marcado"}`}>
                <Avatar name={fullName(m)} avatarUrl={m.user.avatarUrl} size="xs" />
                <span
                  className={`absolute -bottom-1 -right-1 min-w-[16px] h-4 px-0.5 rounded flex items-center justify-center text-[10px] font-bold border bg-[var(--surface)] ${
                    value ? INTENSITY_COLORS[value] : "border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {value ?? "–"}
                </span>
              </div>
            );
          })}
        </div>
      </li>
    );
  };

  const box = "bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--card-shadow)] px-3 sm:px-4 py-2";
  const heading = "text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pt-1.5";

  return (
    <div className="space-y-4">
      {/* Cabecera de la mesa */}
      <div className={`${box} py-3`}>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            ← Asistentes
          </button>
          <button
            onClick={copy}
            className="px-3 py-1 bg-[var(--surface-hover)] text-[var(--text-secondary)] rounded-xl text-xs font-medium hover:text-[var(--primary)] transition-all duration-200"
          >
            {copied ? "Enlace copiado" : "↗ Copiar enlace"}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex -space-x-2 shrink-0">
            {members.map((m) => (
              <div key={m.id} className="rounded-full ring-2 ring-[var(--surface)]">
                <Avatar name={fullName(m)} avatarUrl={m.user.avatarUrl} size="sm" />
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[var(--text)] leading-tight">
              Mesa de {members.length}: {joinNames(memberIds.map(nameOf))}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {all.length === 0
                ? "Ningún juego os apetece a todos… todavía"
                : `${all.length} ${all.length === 1 ? "juego os apetece" : "juegos os apetecen"} a todos, ordenados para que nadie se aburra`}
            </p>
            {silent.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                {silent.length === 1 && silent[0] === currentAttendeeId
                  ? "Aún no has marcado juegos: hazlo en «Juegos» para afinar la mesa."
                  : `${joinNames(silent.map(nameOf))} aún no ${silent.length === 1 ? "ha" : "han"} marcado juegos.`}
              </p>
            )}
          </div>
        </div>
      </div>

      {all.length > 0 && (
        <div className={box}>
          <h3 className={heading}>Os apetece a todos ({all.length})</h3>
          <ul className="divide-y divide-[var(--border)]">
            {all.map((row, i) => renderRow(row, i + 1, "all"))}
          </ul>
        </div>
      )}

      {almost.length > 0 && (
        <div className={box}>
          <h3 className={heading}>Casi: a todos menos uno ({almost.length})</h3>
          <ul className="divide-y divide-[var(--border)]">
            {almost.map((row) => renderRow(row, null, "almost"))}
          </ul>
        </div>
      )}

      {played.length > 0 && (
        <div className={box}>
          <h3 className={heading}>Alguien ya lo ha jugado ({played.length})</h3>
          <ul className="divide-y divide-[var(--border)]">
            {played.map((row) => renderRow(row, null, "played"))}
          </ul>
        </div>
      )}

      {all.length === 0 && almost.length === 0 && played.length === 0 && (
        <p className="text-[var(--text-secondary)] text-center py-8">
          No hay juegos en común en esta mesa. Probad a marcar más juegos en la pestaña «Juegos».
        </p>
      )}
    </div>
  );
}
