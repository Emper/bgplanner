"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/pushClient";
import { silenceNudges } from "@/lib/pushNudge";

// «Avisarme en este dispositivo»: las notificaciones de la campana también
// como push. Cada dispositivo se activa por separado, y el permiso solo se
// pide al pulsar (los navegadores castigan pedirlo sin un gesto).
export default function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState("unavailable"));
  }, []);

  if (state === "loading" || state === "unavailable") return null;

  const on = state === "on";
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (on) {
        setState(await disablePush());
        // Apagados a mano: no volvemos a ofrecerlos por nuestra cuenta
        silenceNudges();
      } else {
        setState(await enablePush("settings"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se han podido cambiar los avisos");
      setTimeout(() => setError(""), 4000);
    } finally {
      setBusy(false);
    }
  };

  let hint: string;
  switch (state) {
    case "needs-install":
      hint =
        "En iPhone y iPad los avisos llegan con BG Planner en la pantalla de inicio: toca Compartir → «Añadir a pantalla de inicio», ábrela desde ahí y actívalos.";
      break;
    case "unsupported":
      hint = "Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o Safari.";
      break;
    case "denied":
      hint =
        "Has bloqueado los avisos de BG Planner en este navegador. Permítelos en los ajustes del sitio y vuelve aquí.";
      break;
    default:
      hint = on
        ? "Te llegarán aunque tengas la app cerrada."
        : "Recibe las notificaciones en este dispositivo aunque tengas la app cerrada.";
  }

  const canToggle = state === "on" || state === "off";

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--card-shadow)] mb-4">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p id="push-toggle-label" className="text-sm font-semibold text-[var(--text)]">
            Avisarme en este dispositivo
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{hint}</p>
          {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
        </div>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="push-toggle-label"
            onClick={toggle}
            disabled={busy}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-60 ${
              on ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                on ? "translate-x-5" : ""
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
}
