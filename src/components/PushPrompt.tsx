"use client";

import { useCallback, useEffect, useState } from "react";
import { enablePush, getPushState, isStandalone } from "@/lib/pushClient";
import {
  PUSH_NUDGE_EVENT,
  canInstall,
  canNudge,
  listenForInstallPrompt,
  markNudgeShown,
  nudgeSource,
  promptInstall,
  snoozeNudges,
  type PushNudgeReason,
} from "@/lib/pushNudge";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

// Nuestra propia hoja para ofrecer los avisos antes de que salga el diálogo
// del sistema. Ese diálogo solo se lanza al pulsar «Activar avisos»: pedirlo
// en frío lo quema (quien dice «Bloquear» ya no vuelve a verlo). Se monta una
// vez en el layout raíz y se pide con nudgePush() desde cualquier página.

const COPY: Record<PushNudgeReason, { emoji: string; title: string; lead: string }> = {
  launch: {
    emoji: "📲",
    title: "¿Te avisamos al móvil?",
    lead: "Ya tienes BG Planner en la pantalla de inicio. Deja que sea ella la que te dé un toque cuando pase algo:",
  },
  "community-thread": {
    emoji: "💬",
    title: "¿Te avisamos cuando te respondan?",
    lead: "Tu hilo ya está publicado. Si alguien contesta, te enteras al momento, aunque tengas la app cerrada:",
  },
  "community-reply": {
    emoji: "💬",
    title: "¿Te avisamos si la charla sigue?",
    lead: "Respuesta publicada. Si alguien más se suma al hilo, te llega al momento, aunque tengas la app cerrada:",
  },
  event: {
    emoji: "🎟️",
    title: "¡Te has apuntado! ¿Te avisamos?",
    lead: "Así no te pierdes quién más se suma ni qué juegos llegan a la mesa:",
  },
  group: {
    emoji: "🎲",
    title: "¡Ya estás dentro! ¿Te avisamos?",
    lead: "Que la próxima convocatoria del grupo no te pille por sorpresa:",
  },
};

const PERKS = [
  { emoji: "📣", text: "Convocatorias de tus grupos" },
  { emoji: "💬", text: "Respuestas en la Comunidad" },
  { emoji: "🎲", text: "Juegos nuevos en tus eventos" },
];

type Phase = "ask" | "busy" | "done" | "denied";

export default function PushPrompt() {
  const [reason, setReason] = useState<PushNudgeReason | null>(null);
  const [phase, setPhase] = useState<Phase>("ask");
  const [error, setError] = useState("");
  const [installable, setInstallable] = useState(false);

  // Solo se ofrece si los avisos están apagados aquí y no lo han descartado
  // hace poco. Con «denied», «unsupported» o «unavailable» (o sin sesión) no
  // sale nada: eso se explica en la página de Notificaciones.
  const offer = useCallback(async (next: PushNudgeReason) => {
    if (!canNudge(next)) return;
    if (next === "launch" && !isStandalone()) return;
    const state = await getPushState().catch(() => "unavailable" as const);
    if (state === "on" && next === "launch") markNudgeShown("launch");
    if (state !== "off") return;
    markNudgeShown(next);
    setPhase("ask");
    setError("");
    setReason((current) => current ?? next);
  }, []);

  useEffect(() => {
    listenForInstallPrompt();
    const onNudge = (e: Event) => {
      const detail = (e as CustomEvent<{ reason?: PushNudgeReason }>).detail;
      if (detail?.reason && detail.reason in COPY) offer(detail.reason);
    };
    window.addEventListener(PUSH_NUDGE_EVENT, onNudge);
    // La app instalada que se abre con la sesión ya hecha (en Android la
    // comparte con el navegador): se ofrece una vez, dejando pintar antes.
    const timer = isStandalone() ? setTimeout(() => offer("launch"), 1200) : undefined;
    return () => {
      window.removeEventListener(PUSH_NUDGE_EVENT, onNudge);
      clearTimeout(timer);
    };
  }, [offer]);

  const close = useCallback(() => {
    setReason(null);
    setPhase("ask");
  }, []);

  const later = useCallback(() => {
    snoozeNudges();
    close();
  }, [close]);

  // Hecho: se va sola salvo que haya algo más que ofrecer (instalar la app)
  useEffect(() => {
    if (phase !== "done" || installable) return;
    const t = setTimeout(close, 2500);
    return () => clearTimeout(t);
  }, [phase, installable, close]);

  if (!reason) return null;

  const activate = async () => {
    setPhase("busy");
    setError("");
    try {
      const state = await enablePush(nudgeSource(reason));
      if (state === "on") {
        setInstallable(!isStandalone() && canInstall());
        setPhase("done");
      } else if (state === "denied") {
        setPhase("denied");
      } else {
        // Cerró el diálogo del sistema sin decidir: cuenta como «Ahora no»
        later();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se han podido activar los avisos");
      setPhase("ask");
    }
  };

  const install = async () => {
    await promptInstall().catch(() => false);
    setInstallable(false);
    close();
  };

  const copy = COPY[reason];
  // Escape o pulsar fuera = «Ahora no» mientras se pregunta (el Modal ya no
  // deja cerrar mientras se activa)
  const dismiss = () => {
    if (phase === "ask") later();
    else close();
  };

  return (
    <Modal open onClose={dismiss} busy={phase === "busy"} size="sm" showClose={false} className="animate-[fade-up_0.3s_ease-out]">
        {phase === "done" ? (
          <div className="text-center py-2">
            <div className="text-4xl mb-2" aria-hidden>
              🔔
            </div>
            <h2 className="text-lg font-bold text-[var(--text)]">¡Avisos activados!</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Te llegarán a este dispositivo aunque tengas BG Planner cerrado.
            </p>
            {installable && (
              <>
                <p className="text-sm text-[var(--text-secondary)] mt-4">
                  Y si la instalas, la tienes a un toque, como cualquier otra app.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button block onClick={install}>
                    📥 Instalar la app
                  </Button>
                  <Button block variant="ghost" onClick={close}>
                    Así está bien
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : phase === "denied" ? (
          <div className="text-center py-2">
            <div className="text-4xl mb-2" aria-hidden>
              🤐
            </div>
            <h2 className="text-lg font-bold text-[var(--text)]">Entendido, sin avisos</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Lo tendrás todo en la campana. Si cambias de idea, permite las notificaciones de BG Planner en los ajustes
              del navegador.
            </p>
            <Button block variant="secondary" onClick={close} className="mt-4">
              Vale
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none" aria-hidden>
                {copy.emoji}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-snug text-[var(--text)]">{copy.title}</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{copy.lead}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 rounded-xl bg-[var(--surface-alt)] p-3">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-center gap-2.5 text-sm text-[var(--text)]">
                  <span aria-hidden>{p.emoji}</span>
                  {p.text}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
              Solo lo que ya sale en tu campana. Se apaga cuando quieras desde Notificaciones.
            </p>
            {error && (
              <p role="alert" className="text-xs text-[var(--danger)] mt-2">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <Button block onClick={activate} loading={phase === "busy"}>
                {phase === "busy" ? "Activando…" : "Activar avisos"}
              </Button>
              <Button block variant="ghost" onClick={later} disabled={phase === "busy"}>
                Ahora no
              </Button>
            </div>
          </>
        )}
    </Modal>
  );
}
