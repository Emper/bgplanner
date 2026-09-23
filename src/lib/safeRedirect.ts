/**
 * El `?redirect=` de login, verificación y onboarding, saneado.
 *
 * Solo vale una ruta de la propia app ("/events/abc"). Cualquier otra cosa
 * ("https://otro.com", "//otro.com", "/\otro.com", "javascript:…") se
 * descarta: si no, bastaría un enlace a bgplanner.app/login con el redirect
 * trucado para mandar a alguien, recién autenticado y confiado, a una web
 * ajena que se haga pasar por la nuestra.
 */
export function safeRedirect(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//") || value.startsWith("/\\")) return "";
  // Tabuladores y saltos de línea los ignora el navegador al resolver la
  // URL, así que "/\t/otro.com" acabaría siendo "//otro.com".
  if (/[\u0000-\u001f\u007f]/.test(value)) return "";
  return value;
}
