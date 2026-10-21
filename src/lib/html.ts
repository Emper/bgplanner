// Escapa HTML en cualquier string que venga del usuario antes de meterlo en
// una plantilla de email. Usar SIEMPRE para contenido no confiable.
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Un objeto como JSON-LD listo para meter en un <script> con
 * dangerouslySetInnerHTML: sin un "</script>" que cierre la etiqueta antes
 * de tiempo si algún texto del usuario lo lleva.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
