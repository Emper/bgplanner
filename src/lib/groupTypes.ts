// Registro central de tipos de grupo. Para añadir un modo nuevo basta con
// añadir una entrada a GROUP_TYPES — la UI, validación y ranking lo recogen
// automáticamente desde aquí.

export type GroupTypeId = "friends" | "couple";

export interface VoteOption {
  value: number;
  emoji: string;
  label: string;          // texto corto p. ej. "Imprescindible"
  shortLabel: string;     // texto compacto p. ej. "+5"
  tone: "positive" | "negative" | "super" | "neutral";
}

export interface VoteLimit {
  value: number;          // valor de voto al que aplica
  max: number;            // nº máximo simultáneo de votos con ese valor por usuario en el grupo
  errorMessage: string;   // mensaje al superar el límite
}

export interface GroupTypeConfig {
  id: GroupTypeId;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
  recommendedFor: string[];
  allowedVotes: VoteOption[];
  voteLimits: VoteLimit[];
  rankingHint?: string;
}

const FRIENDS: GroupTypeConfig = {
  id: "friends",
  label: "Con amigos",
  emoji: "🎲",
  tagline: "El clásico para tu mesa de toda la vida",
  description:
    "Vota cada juego con un pulgar arriba o abajo y reserva tu super voto para tu favorito.",
  recommendedFor: [
    "Grupos de 3 o más jugadores",
    "Quedadas habituales con amigos",
    "Cuando queréis un ranking colectivo y rápido",
  ],
  allowedVotes: [
    { value: -1, emoji: "👎", label: "No me apetece", shortLabel: "-1", tone: "negative" },
    { value: 1, emoji: "👍", label: "Me apetece", shortLabel: "+1", tone: "positive" },
    { value: 3, emoji: "🔥", label: "Super voto", shortLabel: "+3", tone: "super" },
  ],
  voteLimits: [
    {
      value: 3,
      max: 1,
      errorMessage: "Ya tienes un super voto en este grupo",
    },
  ],
};

const COUPLE: GroupTypeConfig = {
  id: "couple",
  label: "En pareja",
  emoji: "💞",
  tagline: "Más matiz para decidir entre dos",
  description:
    "Una escala de -1 a +5 para que cada juego refleje cuánto te apetece de verdad. Sin límites: úsala como mejor te exprese.",
  recommendedFor: [
    "Grupos de 2 jugadores",
    "Cuando los pulgares se quedan cortos",
    "Para sacar fácil los juegos que os encajan a los dos",
  ],
  allowedVotes: [
    { value: -1, emoji: "👎", label: "No me apetece", shortLabel: "-1", tone: "negative" },
    { value: 1, emoji: "🙂", label: "Vale", shortLabel: "+1", tone: "neutral" },
    { value: 2, emoji: "👍", label: "Me apetece", shortLabel: "+2", tone: "positive" },
    { value: 3, emoji: "✨", label: "Mucho", shortLabel: "+3", tone: "positive" },
    { value: 4, emoji: "💖", label: "Muchísimo", shortLabel: "+4", tone: "positive" },
    { value: 5, emoji: "🔥", label: "Imprescindible", shortLabel: "+5", tone: "super" },
  ],
  voteLimits: [],
  rankingHint: "Reserva los +5 para los imprescindibles: si todo es +5, nada destaca.",
};

export const GROUP_TYPES: Record<GroupTypeId, GroupTypeConfig> = {
  friends: FRIENDS,
  couple: COUPLE,
};

export const GROUP_TYPE_IDS = Object.keys(GROUP_TYPES) as GroupTypeId[];

export function isGroupTypeId(value: unknown): value is GroupTypeId {
  return typeof value === "string" && value in GROUP_TYPES;
}

export function getGroupType(id: string | null | undefined): GroupTypeConfig {
  if (id && isGroupTypeId(id)) return GROUP_TYPES[id];
  return GROUP_TYPES.friends;
}

export function isVoteValueAllowed(typeId: string, value: number): boolean {
  const cfg = getGroupType(typeId);
  return cfg.allowedVotes.some((v) => v.value === value);
}

export function findVoteOption(typeId: string, value: number): VoteOption | undefined {
  return getGroupType(typeId).allowedVotes.find((v) => v.value === value);
}
