// Las ganas de jugar a un juego en un evento (0-5). Lo usan la ficha del
// evento, la mesa y la lista compartida, que tienen que hablar igual.
//
// El 0 no es "pocas ganas": es un veto. No cuenta como interés, va siempre al
// final y saca el juego de la mesa de quien lo ha marcado.

export const VETO = 0;

/** De más a menos ganas, con el veto al final. */
export const INTENSITY_LEVELS = [5, 4, 3, 2, 1, VETO] as const;

export const isVeto = (intensity: number) => intensity === VETO;

export const INTENSITY_LABELS: Record<number, string> = {
  5: "Necesito jugarlo",
  4: "Me encantaría",
  3: "Sí, ¡vamos a probarlo!",
  2: "Si surge, me va bien",
  1: "Solo si no queda otra",
  0: "No quiero jugarlo",
};

// Mapa de calor: rojo es lo que más apetece y se enfría hasta el 1. El veto
// se sale de la escala: ficha oscura y maciza.
export const INTENSITY_COLORS: Record<number, string> = {
  5: "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-300 border-red-500",
  4: "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border-orange-500",
  3: "bg-[var(--accent-soft)] text-[var(--primary)] border-[var(--primary)]",
  2: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500",
  1: "bg-slate-500/10 text-slate-500 dark:bg-slate-400/10 dark:text-slate-400 border-slate-400 dark:border-slate-500",
  0: "bg-zinc-800 text-zinc-100 border-zinc-800 dark:bg-black dark:text-zinc-400 dark:border-zinc-600",
};

/** Lo que se pinta en las fichas pequeñas: el número, o ✕ para el veto. */
export const intensityMark = (intensity: number) => (isVeto(intensity) ? "✕" : String(intensity));

/** "5. Necesito jugarlo" / "✕ No quiero jugarlo" */
export const intensityText = (intensity: number) =>
  isVeto(intensity) ? `✕ ${INTENSITY_LABELS[VETO]}` : `${intensity}. ${INTENSITY_LABELS[intensity]}`;
