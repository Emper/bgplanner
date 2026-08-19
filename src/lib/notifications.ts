/**
 * Catálogo de avisos y despacho de notificaciones.
 *
 * Punto único por el que pasa cualquier aviso que la app manda a una persona,
 * sea por email o por push. Quien emite (un handler de API, un cron) no decide
 * el canal: llama a `notify()` / `notifyMany()` con el contenido de los dos y
 * aquí se resuelve por dónde sale.
 *
 * Para añadir un tipo de aviso nuevo: mételo en `NOTIFICATION_TYPE_IDS` y dale
 * su entrada en `NOTIFICATION_CATALOG`. El panel del perfil y el schema de Zod
 * salen de ahí solos, no hay nada más que tocar.
 */

import { prisma } from "./prisma";
import { resend } from "./resend";
import { sendPush } from "./push";

/* ── Catálogo ─────────────────────────────────────────────────────────── */

export const NOTIFICATION_TYPE_IDS = [
  "group_ping",
  "session_created",
  "event_updates",
  "event_reminder",
  "game_activity",
  "photo_added",
  "group_invitation",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPE_IDS)[number];

export interface NotificationChannels {
  email: boolean;
  push: boolean;
}

export interface NotificationTypeInfo extends NotificationChannels {
  type: NotificationType;
  label: string;
  description: string;
}

interface CatalogEntry {
  type: NotificationType;
  label: string;
  description: string;
  /** Valores por defecto mientras el usuario no toque nada. */
  defaults: NotificationChannels;
}

/**
 * Los tipos salen de lo que la app hace hoy de verdad (ver `src/lib/activity.ts`
 * y los sitios que ya mandan email), no de una lista teórica.
 */
export const NOTIFICATION_CATALOG: readonly CatalogEntry[] = [
  {
    type: "group_ping",
    label: "Convocatorias del grupo",
    description:
      "Cuando alguien de tu grupo convoca partida y te pide que votes tus juegos favoritos.",
    defaults: { email: true, push: true },
  },
  {
    type: "session_created",
    label: "Nuevas sesiones",
    description:
      "Cuando se planifica una sesión de juego nueva en alguno de tus grupos.",
    defaults: { email: true, push: true },
  },
  {
    type: "event_updates",
    label: "Eventos nuevos y cambios de fecha",
    description:
      "Cuando se crea un evento en tus grupos o cambia la fecha o el sitio de uno al que vas.",
    defaults: { email: true, push: true },
  },
  {
    type: "event_reminder",
    label: "Recordatorios de eventos",
    description: "Un aviso poco antes de los eventos a los que te has apuntado.",
    defaults: { email: true, push: true },
  },
  {
    type: "game_activity",
    label: "Votos y comentarios en tus juegos",
    description:
      "Cuando alguien vota o comenta un juego que añadiste tú al grupo.",
    defaults: { email: false, push: true },
  },
  {
    type: "photo_added",
    label: "Fotos nuevas",
    description:
      "Cuando alguien sube fotos a la galería de un grupo o de un evento tuyo.",
    defaults: { email: false, push: true },
  },
  {
    type: "group_invitation",
    label: "Invitaciones a grupos",
    description: "Cuando alguien te invita a unirte a su grupo.",
    defaults: { email: true, push: true },
  },
];

const CATALOG_BY_TYPE = new Map<NotificationType, CatalogEntry>(
  NOTIFICATION_CATALOG.map((entry) => [entry.type, entry])
);

export function isNotificationType(value: string): value is NotificationType {
  return CATALOG_BY_TYPE.has(value as NotificationType);
}

function defaultsFor(type: NotificationType): NotificationChannels {
  return CATALOG_BY_TYPE.get(type)?.defaults ?? { email: true, push: true };
}

/* ── Preferencias ─────────────────────────────────────────────────────── */

export type PreferenceMap = Record<NotificationType, NotificationChannels>;

/**
 * Preferencias efectivas de un usuario: los valores por defecto del catálogo
 * pisados por las filas que ese usuario haya guardado. En la BD solo se
 * almacenan las que ha cambiado, así que un usuario nuevo no tiene ninguna.
 */
export async function getPreferences(userId: string): Promise<PreferenceMap> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { type: true, email: true, push: true },
  });
  return mergePreferences(rows);
}

function mergePreferences(
  rows: { type: string; email: boolean; push: boolean }[]
): PreferenceMap {
  const saved = new Map(rows.map((r) => [r.type, r]));
  const result = {} as PreferenceMap;
  for (const type of NOTIFICATION_TYPE_IDS) {
    const row = saved.get(type);
    result[type] = row
      ? { email: row.email, push: row.push }
      : { ...defaultsFor(type) };
  }
  return result;
}

/** El catálogo entero con los valores efectivos del usuario. Lo consume la UI. */
export async function getCatalogWithPreferences(
  userId: string
): Promise<NotificationTypeInfo[]> {
  const prefs = await getPreferences(userId);
  return NOTIFICATION_CATALOG.map((entry) => ({
    type: entry.type,
    label: entry.label,
    description: entry.description,
    email: prefs[entry.type].email,
    push: prefs[entry.type].push,
  }));
}

/** Guarda (o crea) la preferencia de un tipo concreto. */
export async function setPreference(
  userId: string,
  type: NotificationType,
  channels: NotificationChannels
): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, email: channels.email, push: channels.push },
    update: { email: channels.email, push: channels.push },
  });
}

/* ── Despacho ─────────────────────────────────────────────────────────── */

export interface NotifyPayload {
  /**
   * Contenido del email. El HTML se manda tal cual: quien llama es responsable
   * de escapar con `escapeHtml()` cualquier texto que venga del usuario.
   */
  email?: { subject: string; html: string };
  /** Contenido de la push. Texto plano, sin HTML. */
  push?: {
    title: string;
    body: string;
    /** Datos extra. Usa `url` con una ruta interna para el toque de la push. */
    data?: Record<string, string>;
  };
}

export interface NotifyResult {
  /** A cuántas personas les ha salido por push. */
  push: number;
  /** A cuántas les ha salido por email. */
  email: number;
  /** A cuántas no les ha llegado nada (lo tienen desactivado). */
  skipped: number;
}

/**
 * REGLA DE CANAL — el único sitio donde se decide, no la dupliques:
 *
 *   1. Si la persona tiene la app instalada (al menos un `DeviceToken`) y tiene
 *      la push activada para ese tipo de aviso → se manda SOLO la push.
 *   2. Si no (no tiene app, o tiene la push apagada para ese tipo) y tiene el
 *      email activado → se manda SOLO el email.
 *   3. Si no tiene ninguno de los dos activados → no se manda nada.
 *
 * Nunca se manda por los dos canales a la vez: un mismo aviso duplicado en el
 * móvil y en el buzón es exactamente lo que la gente odia.
 */
export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  payload: NotifyPayload
): Promise<NotifyResult> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const result: NotifyResult = { push: 0, email: 0, skipped: 0 };
  if (ids.length === 0) return result;

  const [users, devices, prefRows] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    }),
    prisma.deviceToken.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, token: true },
    }),
    prisma.notificationPreference.findMany({
      where: { userId: { in: ids }, type },
      select: { userId: true, email: true, push: true },
    }),
  ]);

  const fallback = defaultsFor(type);
  const prefByUser = new Map(prefRows.map((r) => [r.userId, r]));
  const tokensByUser = new Map<string, string[]>();
  for (const device of devices) {
    const list = tokensByUser.get(device.userId);
    if (list) list.push(device.token);
    else tokensByUser.set(device.userId, [device.token]);
  }

  const pushTargets: string[] = [];
  const emailTargets: string[] = [];

  for (const user of users) {
    const pref = prefByUser.get(user.id) ?? fallback;
    const tokens = tokensByUser.get(user.id) ?? [];

    if (tokens.length > 0 && pref.push && payload.push) {
      pushTargets.push(...tokens);
      result.push++;
      continue;
    }
    if (pref.email && payload.email && user.email) {
      emailTargets.push(user.email);
      result.email++;
      continue;
    }
    result.skipped++;
  }

  await Promise.all([
    payload.push && pushTargets.length > 0
      ? sendPush(pushTargets, payload.push).catch(() => {})
      : Promise.resolve(),
    // Fire-and-forget por destinatario: un email que falle no puede tumbar al resto.
    ...emailTargets.map((to) =>
      resend.emails
        .send({
          from: "BG Planner <cesar@tiradacritica.es>",
          to,
          subject: payload.email!.subject,
          html: payload.email!.html,
        })
        .catch(() => {})
    ),
  ]);

  return result;
}

/** Igual que `notifyMany` pero para una sola persona. */
export async function notify(
  userId: string,
  type: NotificationType,
  payload: NotifyPayload
): Promise<NotifyResult> {
  return notifyMany([userId], type, payload);
}
