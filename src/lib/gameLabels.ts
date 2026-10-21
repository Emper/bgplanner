// Cómo se cuenta un juego con palabras: su peso, sus jugadores. Sin
// dependencias de servidor, para cliente y servidor por igual.

/** El peso de BGG (1-5) en palabras, para el tooltip de la etiqueta. */
export function weightLabel(w: number): string {
  if (w < 1.5) return "Ligero";
  if (w < 2.5) return "Medio-ligero";
  if (w < 3.5) return "Medio";
  if (w < 4.5) return "Pesado";
  return "Muy pesado";
}

/** "2-4", "2" o null si BGG no lo sabe. */
export function playersLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}-${max}`;
  return String(min || max);
}

export type WeightId = "light" | "medium" | "heavy";

/**
 * Los tres cubos de peso de todos los filtros («¡A jugar!»,
 * recomendaciones…). Uno solo, para que un juego no sea "ligero" en una
 * pantalla y "medio" en otra.
 */
export const WEIGHT_FILTERS: {
  id: WeightId;
  emoji: string;
  label: string;
  fits: (w: number) => boolean;
}[] = [
  { id: "light", emoji: "🪶", label: "Ligero", fits: (w) => w < 2 },
  { id: "medium", emoji: "⚖️", label: "Medio", fits: (w) => w >= 2 && w < 3 },
  { id: "heavy", emoji: "🧠", label: "Duro", fits: (w) => w >= 3 },
];

/** ¿Cae este peso en el cubo pedido? Sin peso conocido, no se descarta. */
export function fitsWeight(weight: number | null | undefined, id: WeightId | "" | null | undefined): boolean {
  if (!id || !weight) return true;
  return WEIGHT_FILTERS.find((f) => f.id === id)?.fits(weight) ?? true;
}
