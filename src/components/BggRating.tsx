// Hexágono de valoración estilo BGG. Colores oficiales de BoardGameGeek por
// nota (se toma la parte entera, igual que BGG: 8.1 usa el color del 8).
// Fuente: hilo oficial de BGG con los códigos de color de las valoraciones.
export function bggRatingColor(rating: number): string {
  const n = Math.max(1, Math.min(10, Math.floor(rating)));
  if (n <= 2) return "#db303b"; // rojo
  if (n <= 4) return "#df4751"; // rojo claro
  if (n <= 6) return "#5369a2"; // azul-morado
  if (n === 7) return "#1d8acd"; // azul
  if (n === 8) return "#2fc482"; // verde
  return "#249563"; // 9-10 verde oscuro
}

export default function BggRating({
  rating,
  size = 34,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center text-white font-bold shrink-0 leading-none text-[11px] sm:text-xs ${className}`}
      style={{
        backgroundColor: bggRatingColor(rating),
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        width: size,
        height: size * 1.12,
      }}
      title={`Valoración en BGG: ${rating.toFixed(1)}`}
    >
      {rating.toFixed(1)}
    </span>
  );
}
