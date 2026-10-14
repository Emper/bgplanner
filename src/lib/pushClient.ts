// Lado navegador de las notificaciones push: apuntar y desapuntar este
// dispositivo. El envío vive en src/lib/push.ts y el pintado en public/sw.js.

const API = "/api/push/subscriptions";

export type PushState =
  | "loading"
  | "unavailable" // el servidor no tiene push configurado
  | "unsupported" // este navegador no sabe
  | "needs-install" // iPhone/iPad sin instalar: solo funciona desde la pantalla de inicio
  | "denied" // permiso bloqueado en el navegador
  | "off"
  | "on";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac: se le distingue por la pantalla táctil
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function registration() {
  return (
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
  );
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  const sub = await currentSubscription();
  const qs = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : "";
  const res = await fetch(`${API}${qs}`, { credentials: "include" });
  if (!res.ok) return "unavailable";
  const data = (await res.json()) as { publicKey: string | null; subscribed: boolean };
  if (!data.publicKey) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  return sub && data.subscribed && Notification.permission === "granted" ? "on" : "off";
}

/** Pide permiso (tiene que venir de un clic) y apunta este dispositivo. */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";

  const res = await fetch(API, { credentials: "include" });
  const { publicKey } = (await res.json()) as { publicKey: string | null };
  if (!publicKey) return "unavailable";

  const reg = await registration();
  const key = base64UrlToBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  // Una suscripción hecha con otra clave no sirve: se rehace
  const oldKey = sub?.options.applicationServerKey;
  if (sub && oldKey && !sameBytes(new Uint8Array(oldKey), key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const saved = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(sub.toJSON()),
  });
  if (!saved.ok) {
    const data = await saved.json().catch(() => ({}));
    throw new Error(data.error || "No se han podido activar los avisos");
  }
  return "on";
}

/** Deja de avisar en este dispositivo (también al cerrar sesión). */
export async function disablePush(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  const sub = await currentSubscription();
  if (!sub) return "off";
  await fetch(API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  return "off";
}

/** El numerito del icono de la app instalada, a juego con la campana. */
export function syncAppBadge(unread: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge()).catch(() => {});
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
