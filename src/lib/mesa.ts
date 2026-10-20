// "Armar mesa": de los juegos de un evento, qué les apetece a un grupo
// concreto de asistentes y en qué orden jugarlos.
//
// El orden no es la suma de ganas: un juego que a dos les encanta y a otro le
// da igual no debería ganar a uno que les gusta a todos. Manda la persona que
// menos ganas tiene ("que nadie se aburra") y desempata la media. Y si alguien
// lo ha vetado (0), no se juega en esa mesa: va aparte, al final.

import { isVeto } from "./intensity";

export interface MesaInterest {
  attendeeId: string;
  intensity: number;
  playedAt: string | null;
}

export interface MesaGameInput {
  id: string;
  game: {
    name: string;
    minPlayers: number | null;
    maxPlayers: number | null;
    bggRating: number | null;
  };
  interests: MesaInterest[];
}

export type MesaMood = "fire" | "consensus" | "split" | null;

export interface MesaRow<G extends MesaGameInput> {
  eventGame: G;
  /** Ganas de cada miembro de la mesa, en el orden de la mesa (null = no lo marcó). */
  intensities: (number | null)[];
  min: number;
  mean: number;
  mood: MesaMood;
  /** Aviso de número de jugadores, o null si la mesa cabe. */
  playersWarning: string | null;
  /** Miembros que no lo marcaron (solo en "casi"). */
  missing: string[];
  /** Miembros que ya lo han jugado. */
  playedBy: string[];
  /** Miembros que no quieren jugarlo. */
  vetoedBy: string[];
}

export interface MesaResult<G extends MesaGameInput> {
  all: MesaRow<G>[];
  almost: MesaRow<G>[];
  played: MesaRow<G>[];
  vetoed: MesaRow<G>[];
}

function moodOf(values: number[]): MesaMood {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min >= 4) return "fire";
  if (max - min >= 3) return "split";
  if (min >= 3) return "consensus";
  return null;
}

function playersWarningOf(size: number, game: MesaGameInput["game"]): string | null {
  if (game.maxPlayers && size > game.maxPlayers) return `Máx. ${game.maxPlayers} jugadores`;
  if (game.minPlayers && size < game.minPlayers) return `Necesita ${game.minPlayers}`;
  return null;
}

function compareRows<G extends MesaGameInput>(a: MesaRow<G>, b: MesaRow<G>): number {
  // Lo que no cabe en la mesa, al final de su sección
  const fitA = a.playersWarning ? 1 : 0;
  const fitB = b.playersWarning ? 1 : 0;
  return (
    fitA - fitB ||
    b.min - a.min ||
    b.mean - a.mean ||
    (b.eventGame.game.bggRating ?? 0) - (a.eventGame.game.bggRating ?? 0) ||
    a.eventGame.game.name.localeCompare(b.eventGame.game.name, "es")
  );
}

/**
 * @param members ids de asistente de la mesa, en el orden en que se pintan.
 */
export function buildMesa<G extends MesaGameInput>(games: G[], members: string[]): MesaResult<G> {
  const size = members.length;
  const result: MesaResult<G> = { all: [], almost: [], played: [], vetoed: [] };

  for (const eg of games) {
    const byAttendee = new Map(eg.interests.map((i) => [i.attendeeId, i]));
    const intensities = members.map((id) => byAttendee.get(id)?.intensity ?? null);
    const marked = intensities.filter((v): v is number => v !== null);
    if (marked.length === 0) continue;
    // Las ganas de quien sí quiere jugarlo
    const values = marked.filter((v) => !isVeto(v));

    const missing = members.filter((id) => !byAttendee.has(id));
    const playedBy = members.filter((id) => byAttendee.get(id)?.playedAt);
    const vetoedBy = members.filter((id) => {
      const interest = byAttendee.get(id);
      return interest ? isVeto(interest.intensity) : false;
    });

    // "Casi" es que falte uno solo, y solo tiene sentido a partir de tres: con
    // dos, que falte uno es que solo lo quiere el otro.
    const isAll = missing.length === 0;
    const isAlmost = size >= 3 && missing.length === 1;
    if (!isAll && !isAlmost) continue;
    // Vetado por todos los que lo marcaron: aquí no se lo pide nadie
    if (values.length === 0) continue;

    const row: MesaRow<G> = {
      eventGame: eg,
      intensities,
      min: values.length ? Math.min(...values) : 0,
      mean: values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0,
      mood: isAll && vetoedBy.length === 0 ? moodOf(values) : null,
      playersWarning: playersWarningOf(size, eg.game),
      missing,
      playedBy,
      vetoedBy,
    };

    if (vetoedBy.length > 0) result.vetoed.push(row);
    else if (playedBy.length > 0) result.played.push(row);
    else if (isAll) result.all.push(row);
    else result.almost.push(row);
  }

  result.all.sort(compareRows);
  result.almost.sort(compareRows);
  result.played.sort(compareRows);
  // Primero los que menos vetos tienen: son los más fáciles de reconducir
  result.vetoed.sort((a, b) => a.vetoedBy.length - b.vetoedBy.length || compareRows(a, b));
  return result;
}
