import { after } from "next/server";

/**
 * Trabajo para después de responder: emails, avisos, el log de actividad,
 * borrar fotos del almacenamiento… Sin bloquear la respuesta y sin perderlo
 * (en Vercel una promesa suelta muere al congelarse la función en cuanto se
 * responde; `after` la deja terminar). Un fallo aquí nunca rompe nada.
 */
export function inBackground(task: () => Promise<unknown>) {
  const run = () =>
    task().catch((err) => {
      console.error("[inBackground]", err);
    });
  try {
    after(run);
  } catch {
    // Fuera de una petición (scripts, crons a mano): a la antigua.
    void run();
  }
}
