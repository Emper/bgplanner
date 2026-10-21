// Utilidades para texto que escriben los usuarios. Cualquier texto puede
// llevar emojis, y un emoji ocupa dos unidades UTF-16 (surrogate pair).
// Cortarlo a lo bruto lo parte por la mitad y deja un "surrogate" suelto, que
// revienta al serializar a JSON o al guardarlo en Postgres. Estos helpers
// evitan ese problema.

// Quita lo que Postgres/JSON no pueden almacenar: bytes nulos y mitades
// sueltas de emoji (por un corte a medias en el cliente, por ejemplo).
export function sanitizeUserText(value: string): string {
  return value
    .replace(/\x00/g, "")
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      ""
    );
}

// Trunca a `max` caracteres reales (no unidades UTF-16) para que un emoji
// nunca se quede partido.
export function truncateChars(value: string, max: number): string {
  const chars = Array.from(value);
  if (chars.length <= max) return value;
  return chars.slice(0, max).join("");
}

/** Tope de la info general de un evento: da para horarios, normas y cómo llegar. */
export const EVENT_ABOUT_MAX = 10000;

/** Texto en una sola línea y recortado, para descripciones meta y similares. */
export function excerpt(value: string, max: number): string {
  const flat = value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/^\s*#{1,3}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (Array.from(flat).length <= max) return flat;
  const cut = truncateChars(flat, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

/**
 * "1 juego", "3 juegos", "1.234 partidas": el número (con separador de
 * miles) y la palabra que le toca.
 */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("es-ES")} ${n === 1 ? one : many}`;
}

/** Solo la palabra: "juego" o "juegos". */
export function pluralWord(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "Ana", "Ana y Luis", "Ana, Luis y Marta". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
