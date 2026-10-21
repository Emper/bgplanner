// Copiar y compartir enlaces. Devuelven si salió bien para que la UI diga
// «Copiado» solo cuando es verdad.

/** Copia al portapapeles. false si el navegador no deja (http, permisos…). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "copied" | "aborted" | "failed";

/**
 * En el móvil, el menú de compartir del sistema; donde no lo hay (o falla),
 * al portapapeles. Cerrar el menú sin elegir nada es "aborted", no un error.
 */
export async function shareOrCopy({ title, text, url }: { title?: string; text?: string; url: string }): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "aborted";
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}
