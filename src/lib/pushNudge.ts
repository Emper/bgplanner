// Cuándo ofrecer «Avisarme en este dispositivo» por iniciativa nuestra: al
// abrir la app instalada tras entrar y justo después de algo que da pie a un
// aviso (publicar en la Comunidad, apuntarse a un evento, unirse a un grupo).
// Lo pinta <PushPrompt />, montado una vez en el layout raíz; aquí solo se
// pide y se lleva la cuenta de los descartes. Va en localStorage porque la
// suscripción también es por dispositivo.

import type { PushSource } from "./pushClient";

export type PushNudgeReason = "launch" | "community-thread" | "community-reply" | "event" | "group";

export const PUSH_NUDGE_EVENT = "bgp:push-nudge";

const KEY = "bgp:push-nudge";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS = 3;

type NudgeStore = { snoozedUntil?: number; dismissals?: number; launchShown?: boolean };

function read(): NudgeStore {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as NudgeStore;
  } catch {
    return {};
  }
}

function write(patch: NudgeStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  } catch {
    // modo privado o almacenamiento bloqueado: se volverá a ofrecer, sin más
  }
}

/** Pide que se ofrezcan los avisos; si toca o no lo decide <PushPrompt />. */
export function nudgePush(reason: PushNudgeReason) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PUSH_NUDGE_EVENT, { detail: { reason } }));
}

/** ¿Se puede ofrecer ahora por iniciativa propia? */
export function canNudge(reason: PushNudgeReason) {
  const s = read();
  if ((s.dismissals ?? 0) >= MAX_DISMISSALS) return false;
  if (s.snoozedUntil && s.snoozedUntil > Date.now()) return false;
  if (reason === "launch" && s.launchShown) return false;
  return true;
}

export function markNudgeShown(reason: PushNudgeReason) {
  if (reason === "launch") write({ launchShown: true });
}

/** «Ahora no»: dos semanas de silencio, y a la tercera ya no se insiste. */
export function snoozeNudges() {
  write({ snoozedUntil: Date.now() + SNOOZE_MS, dismissals: (read().dismissals ?? 0) + 1 });
}

/** Quien los apaga a mano en Notificaciones no quiere que se le vuelvan a ofrecer. */
export function silenceNudges() {
  write({ dismissals: MAX_DISMISSALS });
}

export function nudgeSource(reason: PushNudgeReason): PushSource {
  if (reason === "community-thread" || reason === "community-reply") return "community";
  return reason;
}

// «Instalar app» en Android y escritorio: el navegador ofrece el evento una
// vez y hay que guardarlo para lanzarlo después desde un clic.
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installEvent: InstallPromptEvent | null = null;
let installListening = false;

export function listenForInstallPrompt() {
  if (installListening || typeof window === "undefined") return;
  installListening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
  });
}

export function canInstall() {
  return installEvent !== null;
}

/** Lanza el diálogo de instalación del navegador; true si la instalan. */
export async function promptInstall() {
  const e = installEvent;
  if (!e) return false;
  installEvent = null; // solo vale una vez
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}
