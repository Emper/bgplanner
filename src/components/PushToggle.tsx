"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/pushClient";
import { silenceNudges } from "@/lib/pushNudge";
import { Switch } from "./ui/Field";
import { cardClass } from "./ui/Card";
import { useToast } from "./ui/Toast";

// «Avisarme en este dispositivo»: las notificaciones de la campana también
// como push. Cada dispositivo se activa por separado, y el permiso solo se
// pide al pulsar (los navegadores castigan pedirlo sin un gesto).
export default function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

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
    try {
      if (on) {
        setState(await disablePush());
        // Apagados a mano: no volvemos a ofrecerlos por nuestra cuenta
        silenceNudges();
      } else {
        setState(await enablePush("settings"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se han podido cambiar los avisos");
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
    <div className={cardClass({ padding: "none", className: "p-4 mb-4" })}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          {canToggle ? (
            <Switch
              checked={on}
              onChange={toggle}
              disabled={busy}
              label="Avisarme en este dispositivo"
              description={hint}
            />
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--text)]">Avisarme en este dispositivo</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{hint}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
