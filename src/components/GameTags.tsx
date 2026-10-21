import { formatDateShort, formatDuration } from "@/lib/format";

// Las etiquetas de un juego en cualquier listado (colección, añadir juegos,
// ranking del grupo, evento, recomendaciones, «¡A jugar!»): siempre el mismo
// color e icono para el mismo dato y escritas para leerse sin leyenda
// («4 partidas», no «🎲 4»). Cada listado pasa lo que tiene; lo que falta no
// se pinta.

export type GameTagTone =
  | "neutral"
  | "amber"
  | "cyan"
  | "purple"
  | "green"
  | "red"
  | "pink";

const TONES: Record<GameTagTone, string> = {
  neutral: "bg-[var(--surface-hover)] text-[var(--text-secondary)]",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cyan: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  green: "bg-green-500/15 text-green-700 dark:text-green-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

const SIZES = {
  md: "gap-1 px-2 py-0.5 text-xs",
  // Para filas apretadas: en el móvil encoge, desde sm es como la normal.
  sm: "gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs",
};

export function GameTag({
  tone = "neutral",
  size = "md",
  title,
  children,
}: {
  tone?: GameTagTone;
  size?: keyof typeof SIZES;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${SIZES[size]} ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function weightLabel(w: number): string {
  if (w < 1.5) return "Ligero";
  if (w < 2.5) return "Medio-ligero";
  if (w < 3.5) return "Medio";
  if (w < 4.5) return "Pesado";
  return "Muy pesado";
}

function playersLabel(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}-${max}`;
  return String(min || max);
}

export interface GameTagsData {
  bggRank?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  /** «Mejor con…» de BGG, para el tooltip de los jugadores. */
  bestWith?: string | null;
  playingTime?: number | null;
  weight?: number | null;
  /** Partidas del dueño de la colección; sin esto no sale la etiqueta. */
  numPlays?: number;
  /** Partidas sumadas de sus expansiones. */
  expansionPlays?: number;
  /** Su nota personal en BGG. */
  userRating?: number | null;
  /** Fecha de alta en la colección de BGG (ISO). */
  dateAdded?: string | null;
}

/**
 * La fila de etiquetas de un juego. Va dentro de un contenedor flex-wrap del
 * listado, que es quien decide el hueco y qué más va al lado (la nota de
 * BGG, los interesados de un evento…).
 */
export default function GameTags({
  game,
  size = "md",
  owner,
}: {
  game: GameTagsData;
  size?: keyof typeof SIZES;
  /** De quién es la colección, para los tooltips; sin él, son tuyas. */
  owner?: string;
}) {
  const players = playersLabel(game.minPlayers ?? null, game.maxPlayers ?? null);
  const plays = game.numPlays;
  const extra = game.expansionPlays ?? 0;

  return (
    <>
      {game.bggRank ? (
        <GameTag tone="amber" size={size} title="Puesto en el ranking global de BGG">
          🏆 BGG #{game.bggRank.toLocaleString("es-ES")}
        </GameTag>
      ) : null}
      {players && (
        <GameTag
          size={size}
          title={game.bestWith ? `Mejor con ${game.bestWith}` : "Jugadores"}
        >
          👥 {players}
        </GameTag>
      )}
      {game.playingTime ? (
        <GameTag tone="cyan" size={size} title="Duración según BGG">
          ⏱ {formatDuration(game.playingTime)}
        </GameTag>
      ) : null}
      {game.weight ? (
        <GameTag
          tone="purple"
          size={size}
          title={`Peso ${game.weight.toFixed(1)}/5 · ${weightLabel(game.weight)}`}
        >
          ⚖️ {game.weight.toFixed(1)}
        </GameTag>
      ) : null}
      {plays !== undefined &&
        (plays > 0 || extra > 0 ? (
          <GameTag
            tone="green"
            size={size}
            title={
              extra > 0
                ? `Y ${extra} partida${extra === 1 ? "" : "s"} más con expansiones`
                : "Partidas registradas en BGG"
            }
          >
            🎲 {plays} partida{plays === 1 ? "" : "s"}
            {extra > 0 && ` (+${extra})`}
          </GameTag>
        ) : (
          <GameTag tone="red" size={size} title="Ninguna partida registrada en BGG">
            📦 Sin estrenar
          </GameTag>
        ))}
      {game.userRating ? (
        <GameTag
          tone="pink"
          size={size}
          title={owner ? `Nota de ${owner} en BGG` : "Tu nota en BGG"}
        >
          ♥ {game.userRating % 1 === 0 ? game.userRating : game.userRating.toFixed(1)}
        </GameTag>
      ) : null}
      {game.dateAdded && (
        <GameTag size={size} title="Fecha de alta en la colección de BGG">
          🗓 {formatDateShort(game.dateAdded)}
        </GameTag>
      )}
    </>
  );
}
