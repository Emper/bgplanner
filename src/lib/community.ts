// Etiquetas fijas de los hilos de /community. Cada hilo lleva exactamente una
// (como el "flair" de Reddit) y sirven para filtrar el listado. El orden del
// array es el orden de los filtros en pantalla. Sin dependencias de servidor:
// esto lo importan también componentes de cliente.
export const COMMUNITY_TAGS = [
  {
    id: "buscar-partida",
    label: "Buscar partida",
    emoji: "🎲",
    hint: "Te falta gente o buscas mesa",
    accent: "#059669",
  },
  {
    id: "cronicas",
    label: "Crónicas",
    emoji: "📜",
    hint: "Cuenta qué tal fue esa partida",
    accent: "#d97706",
  },
  {
    id: "opiniones",
    label: "Opiniones",
    emoji: "💬",
    hint: "Qué te parece tal juego",
    accent: "#6366f1",
  },
  {
    id: "reglas",
    label: "Dudas de reglas",
    emoji: "📖",
    hint: "Para cuando el manual no se aclara",
    accent: "#0284c7",
  },
  {
    id: "novedades",
    label: "Novedades",
    emoji: "📦",
    hint: "Lanzamientos, mecenazgos y rumores",
    accent: "#db2777",
  },
  {
    id: "offtopic",
    label: "Offtopic",
    emoji: "☕",
    hint: "Todo lo demás",
    accent: "#64748b",
  },
] as const;

export type CommunityTag = (typeof COMMUNITY_TAGS)[number]["id"];

export const COMMUNITY_TAG_IDS = COMMUNITY_TAGS.map((t) => t.id) as unknown as [
  CommunityTag,
  ...CommunityTag[],
];

export function getCommunityTag(id: string) {
  return COMMUNITY_TAGS.find((t) => t.id === id) || COMMUNITY_TAGS[COMMUNITY_TAGS.length - 1];
}

export function isCommunityTag(id: string | null | undefined): id is CommunityTag {
  return !!id && COMMUNITY_TAGS.some((t) => t.id === id);
}

// Límites de longitud compartidos por formularios y validaciones.
export const THREAD_TITLE_MAX = 150;
export const THREAD_BODY_MAX = 10000;
export const REPLY_BODY_MAX = 5000;

// Hilos por página en el listado.
export const THREADS_PAGE_SIZE = 25;
