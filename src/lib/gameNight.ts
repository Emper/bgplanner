// "Noche de juego": de los pendientes de un grupo, qué cabe esta noche para
// los que están sentados a la mesa y en qué orden.
//
// El orden es el del ranking (misma fórmula: suma de votos, desempate por nota
// de BGG), pero contando solo los votos de los presentes: si no viene quien
// puso el super voto, ese juego no sube por él. Fuera quedan los que no
// admiten ese número de jugadores, los que no caben en el tiempo y, si se
// pide, los que no son del peso elegido. Sin dato de BGG no se descarta nada.
//
// No reutiliza "Armar mesa" (mesa.ts) a propósito: allí el que no marca un
// juego no lo quiere y 0 es un veto; aquí no votar es indiferencia y el voto
// negativo ya resta en la suma.

import { WEIGHT_FILTERS, type WeightId } from "@/lib/gameLabels";

export type { WeightId };
/** Los cubos de peso de siempre (lib/gameLabels), los mismos en toda la app. */
export const NIGHT_WEIGHTS = WEIGHT_FILTERS;

/** Tiempos que se ofrecen, en minutos. `null` = sin prisa. */
export const NIGHT_TIMES: (number | null)[] = [60, 90, 120, 180, null];
export const DEFAULT_NIGHT_MINUTES = 120;

export interface NightVote {
  userId: string;
  value: number;
}

export interface NightGameInput {
  game: {
    name: string;
    minPlayers: number | null;
    maxPlayers: number | null;
    playingTime: number | null;
    weight: number | null;
    bggRating: number | null;
  };
  voters: NightVote[];
}

export interface NightRow<G extends NightGameInput> {
  item: G;
  /** Suma de los votos de los presentes. */
  score: number;
  /** Votos de los presentes, en el orden de `players`. */
  votes: NightVote[];
}

export interface NightResult<G extends NightGameInput> {
  rows: NightRow<G>[];
  /** Descartados, cada uno por el primer motivo que no cumple. */
  out: { players: number; time: number; weight: number };
}

export interface NightFilters {
  /** userIds de los que juegan esta noche. */
  players: string[];
  /** Tiempo disponible en minutos, o null si no hay prisa. */
  minutes: number | null;
  weight: WeightId | null;
}

function fitsPlayers(n: number, game: NightGameInput["game"]) {
  return (!game.minPlayers || n >= game.minPlayers) && (!game.maxPlayers || n <= game.maxPlayers);
}

export function buildNight<G extends NightGameInput>(games: G[], filters: NightFilters): NightResult<G> {
  const { players, minutes, weight } = filters;
  const present = new Set(players);
  const order = new Map(players.map((id, i) => [id, i]));
  const weightFits = weight ? NIGHT_WEIGHTS.find((w) => w.id === weight)?.fits : undefined;
  const out = { players: 0, time: 0, weight: 0 };
  const rows: NightRow<G>[] = [];

  for (const item of games) {
    const { game } = item;
    if (!fitsPlayers(players.length, game)) {
      out.players++;
      continue;
    }
    if (minutes !== null && game.playingTime && game.playingTime > minutes) {
      out.time++;
      continue;
    }
    if (weightFits && game.weight && !weightFits(game.weight)) {
      out.weight++;
      continue;
    }
    // value 0 = comentó sin votar
    const votes = item.voters
      .filter((v) => present.has(v.userId) && v.value !== 0)
      .sort((a, b) => order.get(a.userId)! - order.get(b.userId)!);
    rows.push({ item, score: votes.reduce((acc, v) => acc + v.value, 0), votes });
  }

  rows.sort(
    (a, b) =>
      b.score - a.score ||
      (b.item.game.bggRating ?? 0) - (a.item.game.bggRating ?? 0) ||
      a.item.game.name.localeCompare(b.item.game.name, "es")
  );
  return { rows, out };
}

/** Porcentaje superior de la lista que entra en el sorteo. */
const TOP_FRACTION = 0.3;
/** Mínimo de juegos en el bombo (o todos, si hay menos). */
const MIN_POOL = 5;

/**
 * Los que entran en el sorteo: el 30 % superior (mínimo 5). Lo que los
 * presentes votaron en negativo no entra salvo que no quede otra cosa.
 */
export function nightPool<G extends NightGameInput>(rows: NightRow<G>[]): NightRow<G>[] {
  const wanted = rows.filter((r) => r.score >= 0);
  const base = wanted.length ? wanted : rows;
  return base.slice(0, Math.min(base.length, Math.max(MIN_POOL, Math.ceil(base.length * TOP_FRACTION))));
}
