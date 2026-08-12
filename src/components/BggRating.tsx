// Hexágono de valoración estilo BGG. El color sigue una escala aproximada a
// la de BoardGameGeek (verde alto → ámbar medio → rojo bajo). La escala vive
// aquí centralizada para poder ajustarla en un único sitio.
export function bggRatingColor(rating: number): string {
  if (rating >= 9) return "#186b40"; // verde oscuro
  if (rating >= 8) return "#1e9e57"; // verde
  if (rating >= 7) return "#4e9f37"; // verde-lima
  if (rating >= 6) return "#a0891e"; // oliva
  if (rating >= 5) return "#b5721f"; // ámbar
  if (rating >= 4) return "#bb4d2c"; // naranja
  if (rating >= 3) return "#b23330"; // rojo
  return "#8f2622"; // rojo oscuro
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
