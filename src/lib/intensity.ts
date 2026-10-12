// Las ganas de jugar a un juego en un evento (1-5). Lo usan la ficha del
// evento y la lista compartida, que tienen que hablar igual.

export const INTENSITY_LABELS: Record<number, string> = {
  5: "Máxima prioridad",
  4: "Tengo que probarlo",
  3: "Me encantaría",
  2: "Si surge, me va bien",
  1: "Solo si no queda otra",
};

export const INTENSITY_COLORS: Record<number, string> = {
  5: "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-300 border-red-500",
  4: "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border-orange-500",
  3: "bg-[var(--accent-soft)] text-[var(--primary)] border-[var(--primary)]",
  2: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500",
  1: "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-strong)]",
};
