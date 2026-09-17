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
