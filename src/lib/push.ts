import webpush from "web-push";
import { prisma } from "./prisma";

// Notificaciones push: el mismo aviso de la campana, pero en el móvil o el
// escritorio aunque la app esté cerrada. Las dispara `notifyNow` en
// src/lib/notifications.ts; aquí solo se entregan.
//
// Hoy hay un único canal (Web Push, para navegador y PWA). Cuando haya app
// nativa, APNs/FCM entran como otro `PushProvider` con su propia tabla de
// tokens, sin tocar a quien llama a `deliverPush`.

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta interna que se abre al tocar el aviso. */
  url: string;
  /** Avisos con el mismo tag se sustituyen en el dispositivo en vez de apilarse. */
  tag?: string;
  /** Sin leer tras este aviso: el numerito del icono de la app. */
  unread?: number;
}

interface PushProvider {
  /** Si hay algo a lo que mandar, lo manda. Nunca lanza. */
  send(userId: string, payload: () => Promise<PushPayload>): Promise<void>;
}

// ── Web Push (VAPID) ────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

/** Clave pública VAPID, o null si el push no está configurado en este entorno. */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? process.env.VAPID_PUBLIC_KEY
    : null;
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = vapidPublicKey();
  if (!publicKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || APP_URL, publicKey, process.env.VAPID_PRIVATE_KEY!);
  vapidReady = true;
  return true;
}

// Si el dispositivo está apagado, el servicio de push guarda el aviso un día;
// pasado eso ya no tiene sentido enseñarlo.
const TTL_SECONDS = 24 * 60 * 60;

const webPushProvider: PushProvider = {
  async send(userId, payload) {
    if (!ensureVapid()) return;
    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify(await payload());
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            { TTL: TTL_SECONDS, urgency: "normal", timeout: 5000 }
          );
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          });
        } catch (err) {
          // 404/410: el navegador ya no la quiere (desinstalada, permiso
          // retirado, caducada). Fuera, para no insistir.
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          }
        }
      })
    );
  },
};

const PROVIDERS: PushProvider[] = [webPushProvider];

/**
 * Manda un push a todos los dispositivos de `userId`. El contenido se pide
 * solo si hay algún dispositivo, para no hacer consultas de más.
 */
export async function deliverPush(userId: string, payload: () => Promise<PushPayload>) {
  let cached: Promise<PushPayload> | null = null;
  const once = () => (cached ??= payload());
  await Promise.all(PROVIDERS.map((p) => p.send(userId, once).catch(() => {})));
}
