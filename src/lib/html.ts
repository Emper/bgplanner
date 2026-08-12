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
