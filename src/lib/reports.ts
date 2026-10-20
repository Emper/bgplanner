// Denuncias y bloqueos: lo que comparten cliente y servidor (sin prisma).

// Qué se puede denunciar. El id de cada uno es el de su fila en la BD.
export const REPORT_TARGET_TYPES = [
  "thread", // CommunityThread
  "reply", // CommunityReply
  "group_photo", // GroupPhoto
  "event_photo", // EventPhoto
  "review", // GameReview (opinión de un juego, con sus fotos)
  "user", // User (el perfil entero)
  "game_manual", // Game (su enlace al manual, que pone cualquiera)
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** Cómo se nombra cada cosa: «Denunciar este hilo», «denunció un hilo», «Hilo». */
export const REPORT_TARGET_LABELS: Record<ReportTargetType, { this: string; a: string; noun: string }> = {
  thread: { this: "este hilo", a: "un hilo", noun: "Hilo" },
  reply: { this: "esta respuesta", a: "una respuesta", noun: "Respuesta" },
  group_photo: { this: "esta foto", a: "una foto", noun: "Foto de grupo" },
  event_photo: { this: "esta foto", a: "una foto", noun: "Foto de evento" },
  review: { this: "esta opinión", a: "una opinión", noun: "Opinión" },
  user: { this: "a este usuario", a: "un usuario", noun: "Usuario" },
  game_manual: { this: "este enlace al manual", a: "un enlace a un manual", noun: "Enlace a manual" },
};

export const REPORT_REASONS = [
  { id: "spam", label: "Spam o publicidad", emoji: "📢" },
  { id: "offensive", label: "Ofensivo o acoso", emoji: "😠" },
  { id: "inappropriate", label: "Contenido inapropiado", emoji: "🔞" },
  { id: "other", label: "Otro motivo", emoji: "🤔" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
export const REPORT_REASON_IDS = REPORT_REASONS.map((r) => r.id) as unknown as [
  ReportReason,
  ...ReportReason[],
];

export function reportReasonLabel(id: string) {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
}

export const REPORT_TEXT_MAX = 1000;

// Lo que acumule estas denuncias pendientes de personas distintas se oculta
// en la Comunidad hasta que alguien lo revise.
export const AUTO_HIDE_REPORTS = 3;
