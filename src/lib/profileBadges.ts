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
  /** Qué hacer para estrenarla. Solo se enseña en tu propio perfil. */
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
    hint: "Añade juegos a tu colección de BGG",
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
    hint: "Crea un grupo o únete al de tus amigos",
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
    hint: "Apúntate a tu primer evento",
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
    hint: "Organiza un evento y convoca a tu gente",
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
    hint: "Apunta tus partidas en BGG",
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
    hint: "Vota los juegos de tu grupo",
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
    hint: "Cuenta qué tal fue la partida después de jugar",
  },
];

/**
 * Las insignias de un perfil, en orden fijo.
 *
 * @param includeLocked con true salen también las que aún no tiene (tu propio
 *   perfil: ahí sirven de lista de cosas por hacer). A otros solo se les
 *   enseña lo conseguido, que un perfil lleno de huecos no presume de nada.
 */
export function profileBadges(
  stats: ProfileStats,
  { hasBgg, includeLocked }: { hasBgg: boolean; includeLocked: boolean }
): ProfileBadge[] {
  return BADGES.flatMap((def): ProfileBadge[] => {
    const value = def.value(stats);
    if (value === 0 && !includeLocked) return [];

    const reached = def.tiers.filter(([at]) => value >= at);
    const upcoming = def.tiers.find(([at]) => value < at);
    const from = reached.length ? reached[reached.length - 1][0] : 0;
    return [
      {
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
            ? "Conecta tu cuenta de BGG en tu perfil"
            : def.hint,
      },
    ];
  });
}
