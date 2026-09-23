import type { ProfileStats } from "@/lib/publicProfile";

// Las insignias del perfil público: una por cada cosa que se puede hacer en
// la app (tener juegos, estar en grupos, ir a eventos…), con tres niveles
// según la cifra. El nivel es lo que le da la gracia: da una meta a quien
// mira su propio perfil y una idea rápida de con quién tratas a quien mira
// el de otro.

/** 0 = aún no la tiene, 1 = bronce, 2 = plata, 3 = oro. */
export type BadgeTier = 0 | 1 | 2 | 3;

export interface ProfileBadge {
  key: string;
  emoji: string;
  value: number;
  /** "120 juegos en la colección", "Miembro de 3 grupos"… */
  text: string;
  tier: BadgeTier;
  /** Nombre del nivel alcanzado ("Coleccionista"), o null si no tiene. */
  tierName: string | null;
  /** Siguiente nivel, si queda alguno por subir. */
  next: { at: number; name: string } | null;
  /** Cuánto lleva del tramo hasta el siguiente nivel, de 0 a 1. */
  progress: number;
  /** Qué hacer para estrenarla, corto: cabe en la ficha del carrusel. */
  hint: string;
}

interface BadgeDef {
  key: string;
  emoji: string;
  value: (s: ProfileStats) => number;
  text: (n: number) => string;
  /** Umbral y nombre de bronce, plata y oro. */
  tiers: [number, string][];
  hint: string;
  /** Solo tiene sentido con BGG conectado (la colección y las partidas). */
  needsBgg?: boolean;
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("es-ES")} ${n === 1 ? one : many}`;

const BADGES: BadgeDef[] = [
  {
    key: "games",
    emoji: "🎲",
    value: (s) => s.games,
    text: (n) => `${plural(n, "juego", "juegos")} en la colección`,
    tiers: [
      [1, "Primeras cajas"],
      [30, "Coleccionista"],
      [100, "Ludoteca de leyenda"],
    ],
    hint: "Añade juegos en BGG",
    needsBgg: true,
  },
  {
    key: "groups",
    emoji: "👥",
    value: (s) => s.groups,
    text: (n) => `Miembro de ${plural(n, "grupo", "grupos")}`,
    tiers: [
      [1, "Buena compañía"],
      [3, "Alma de la fiesta"],
      [6, "En todas las mesas"],
    ],
    hint: "Únete a un grupo",
  },
  {
    key: "events",
    emoji: "🎉",
    value: (s) => s.events,
    text: (n) => `Participa en ${plural(n, "evento", "eventos")}`,
    tiers: [
      [1, "Primera quedada"],
      [5, "Habitual de las jornadas"],
      [15, "Ruta de convenciones"],
    ],
    hint: "Apúntate a un evento",
  },
  {
    key: "hosted",
    emoji: "🏠",
    value: (s) => s.hosted,
    text: (n) => `${plural(n, "evento organizado", "eventos organizados")}`,
    tiers: [
      [1, "Abre la puerta"],
      [5, "Casa llena"],
      [15, "Jornadas propias"],
    ],
    hint: "Organiza un evento",
  },
  {
    key: "plays",
    emoji: "⚔️",
    value: (s) => s.plays,
    text: (n) => `${plural(n, "partida registrada", "partidas registradas")}`,
    tiers: [
      [1, "Dados rodando"],
      [100, "Mesa caliente"],
      [500, "Mil batallas"],
    ],
    hint: "Apunta partidas en BGG",
    needsBgg: true,
  },
  {
    key: "votes",
    emoji: "🗳️",
    value: (s) => s.votes,
    text: (n) => `${plural(n, "voto repartido", "votos repartidos")}`,
    tiers: [
      [1, "Primer voto"],
      [25, "Voz y voto"],
      [100, "Opinión con peso"],
    ],
    hint: "Vota en tu grupo",
  },
  {
    key: "reviews",
    emoji: "✍️",
    value: (s) => s.reviews,
    text: (n) => `${plural(n, "crónica escrita", "crónicas escritas")}`,
    tiers: [
      [1, "Primera crónica"],
      [10, "Cronista"],
      [50, "Pluma de oro"],
    ],
    hint: "Escribe una crónica",
  },
];

/**
 * Las insignias de un perfil, todas: las conseguidas primero (el oro
 * delante, que es de lo que se presume) y al final las que faltan, como
 * algo aún por desbloquear.
 */
export function profileBadges(
  stats: ProfileStats,
  { hasBgg }: { hasBgg: boolean }
): ProfileBadge[] {
  const badges = BADGES.map((def): ProfileBadge => {
    const value = def.value(stats);
    const reached = def.tiers.filter(([at]) => value >= at);
    const upcoming = def.tiers.find(([at]) => value < at);
    const from = reached.length ? reached[reached.length - 1][0] : 0;
    return {
      key: def.key,
      emoji: def.emoji,
      value,
      text: def.text(value),
      tier: reached.length as BadgeTier,
      tierName: reached.length ? reached[reached.length - 1][1] : null,
      next: upcoming ? { at: upcoming[0], name: upcoming[1] } : null,
      progress: upcoming ? (value - from) / (upcoming[0] - from) : 1,
      hint:
        def.needsBgg && !hasBgg
          ? "Conecta tu BGG"
          : def.hint,
    };
  });
  // sort es estable: a igual nivel se respeta el orden de BADGES.
  return badges.sort((a, b) => b.tier - a.tier);
}
