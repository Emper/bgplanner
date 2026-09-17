// Estados de una propuesta del roadmap. El orden del array es el orden en el
// que se pintan las secciones en /roadmap y en el panel de admin.
export const FEATURE_STATUSES = [
  {
    id: "in_progress",
    label: "En curso",
    hint: "Ya estamos con ello",
    accent: "var(--primary)",
    public: true,
  },
  {
    id: "planned",
    label: "Planificada",
    hint: "Confirmada para una próxima versión",
    accent: "#6366f1",
    public: true,
  },
  {
    id: "proposed",
    label: "Propuesta",
    hint: "En estudio: vuestros votos deciden el orden",
    accent: "#94a3b8",
    public: true,
  },
  {
    id: "done",
    label: "Lista",
    hint: "Ya disponible en la app",
    accent: "#10b981",
    public: true,
  },
  {
    id: "discarded",
    label: "Descartada",
    hint: "No la vamos a hacer, al menos de momento",
    accent: "#ef4444",
    public: false,
  },
] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number]["id"];

export const FEATURE_STATUS_IDS = FEATURE_STATUSES.map((s) => s.id) as unknown as [
  FeatureStatus,
  ...FeatureStatus[],
];

// Estados que se ven en el roadmap público. `discarded` queda solo para admin.
export const PUBLIC_FEATURE_STATUSES = FEATURE_STATUSES.filter((s) => s.public);

export function featureStatusLabel(status: string): string {
  return FEATURE_STATUSES.find((s) => s.id === status)?.label || status;
}

export function featureStatusAccent(status: string): string {
  return FEATURE_STATUSES.find((s) => s.id === status)?.accent || "var(--text-muted)";
}

// Solo se puede votar lo que aún no está hecho ni descartado: votar algo ya
// entregado no aporta información para priorizar.
export function isVotableStatus(status: string): boolean {
  return status === "proposed" || status === "planned" || status === "in_progress";
}
