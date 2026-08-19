/**
 * Emisores de avisos: uno por cada cosa que la app quiere contar.
 *
 * Cada función reúne a quién hay que avisar, monta el email y la push, y se lo
 * pasa a `notifyMany()`, que es quien decide el canal. Los handlers de API solo
 * tienen que llamar a la función que les toque; ni construyen HTML ni saben si
 * la persona tiene la app instalada.
 *
 * Cómo se llaman desde un handler:
 *
 *     import { after } from "next/server";
 *     after(() => notifySessionCreated(...));
 *
 * `after()` (Next 16) ejecuta el trabajo DESPUÉS de mandar la respuesta, así que
 * el usuario no espera por los avisos, pero el runtime tampoco mata la función a
 * medias como pasaría con un `.catch()` suelto sin await. Ninguna de estas
 * funciones lanza: un fallo al avisar jamás debe manchar la acción original.
 */

import { prisma } from "./prisma";
import { escapeHtml } from "./html";
import { notifyMany, type NotifyResult } from "./notifications";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

const EMPTY: NotifyResult = { push: 0, email: 0, skipped: 0 };

/* ── Plantilla de email ───────────────────────────────────────────────── */

/**
 * Envoltorio dark de los emails de la app (mismo aspecto que la convocatoria).
 * `bodyHtml` va tal cual: quien llama ya lo ha escapado.
 */
export function buildEmailHtml(opts: {
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<a href="${opts.ctaUrl}" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">${opts.ctaLabel}</a>`
      : "";
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
      <h2 style="color: #f59e0b; margin: 0 0 16px;">BG Planner</h2>
      ${opts.bodyHtml}
      ${cta}
      <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">Nos vemos en la mesa 🎲<br/>— El equipo de BG Planner</p>
    </div>
  `;
}

/* ── Utilidades ───────────────────────────────────────────────────────── */

/** Nombre visible de una persona, con el mismo orden de preferencia de la app. */
function displayNameOf(user: {
  displayName?: string | null;
  name?: string | null;
  email?: string | null;
}): string {
  return user.displayName || user.name || user.email || "Alguien";
}

/** Miembros de un grupo menos el que ha hecho la acción. */
async function otherGroupMemberIds(
  groupId: string,
  actorUserId: string
): Promise<string[]> {
  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: actorUserId } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/** Asistentes de un evento menos el que ha hecho la acción (los que siguen apuntados). */
async function otherEventAttendeeIds(
  eventId: string,
  actorUserId: string
): Promise<string[]> {
  const attendees = await prisma.eventAttendee.findMany({
    where: {
      eventId,
      userId: { not: actorUserId },
      status: { not: "cancelled" },
    },
    select: { userId: true },
  });
  return attendees.map((a) => a.userId);
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/* ── session_created ──────────────────────────────────────────────────── */

/** Se ha planificado una sesión nueva: avisa al resto del grupo. */
export async function notifySessionCreated(opts: {
  groupId: string;
  actorUserId: string;
  sessionName: string | null;
  date: Date;
  gameNames: string[];
}): Promise<NotifyResult> {
  try {
    const [group, actor, recipientIds] = await Promise.all([
      prisma.group.findUnique({
        where: { id: opts.groupId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: opts.actorUserId },
        select: { name: true, displayName: true, email: true },
      }),
      otherGroupMemberIds(opts.groupId, opts.actorUserId),
    ]);
    if (!group || !actor || recipientIds.length === 0) return EMPTY;

    const actorName = displayNameOf(actor);
    const when = formatDate(opts.date);
    const title = opts.sessionName || "una sesión nueva";
    const url = `/groups/${opts.groupId}?tab=sessions`;

    const gamesHtml = opts.gameNames.length
      ? `<p style="margin: 12px 0 0;">Juegos previstos: <strong>${opts.gameNames
          .map((n) => escapeHtml(n))
          .join(", ")}</strong></p>`
      : "";

    return await notifyMany(recipientIds, "session_created", {
      email: {
        subject: `Nueva sesión en "${group.name}" — ${when}`,
        html: buildEmailHtml({
          bodyHtml: `
            <p style="margin: 0 0 12px; font-size: 18px;"><strong>¡Hay partida!</strong> 🎲</p>
            <p><strong>${escapeHtml(actorName)}</strong> ha planificado ${escapeHtml(
              title
            )} en <strong style="color: #f59e0b;">"${escapeHtml(group.name)}"</strong>.</p>
            <p style="margin: 12px 0 0;">Cuándo: <strong>${escapeHtml(when)}</strong></p>
            ${gamesHtml}`,
          ctaLabel: "Ver la sesión",
          ctaUrl: `${APP_URL}${url}`,
        }),
      },
      push: {
        title: `🎲 Nueva sesión en ${group.name}`,
        body: `${actorName} ha planificado ${title} para el ${when}.`,
        data: { url, groupId: opts.groupId },
      },
    });
  } catch {
    return EMPTY;
  }
}

/* ── event_updates ────────────────────────────────────────────────────── */

/**
 * Ha cambiado la fecha o el sitio de un evento: avisa a los asistentes.
 * Solo se llama cuando algo de eso ha cambiado de verdad, no en cada edición.
 */
export async function notifyEventChanged(opts: {
  eventId: string;
  actorUserId: string;
  eventName: string;
  dateChanged: boolean;
  locationChanged: boolean;
  date: Date;
  location: string | null;
}): Promise<NotifyResult> {
  try {
    const recipientIds = await otherEventAttendeeIds(
      opts.eventId,
      opts.actorUserId
    );
    if (recipientIds.length === 0) return EMPTY;

    const url = `/events/${opts.eventId}`;
    const what =
      opts.dateChanged && opts.locationChanged
        ? "la fecha y el sitio"
        : opts.dateChanged
          ? "la fecha"
          : "el sitio";
    const when = formatDate(opts.date);
    const locationHtml = opts.location
      ? `<p style="margin: 8px 0 0;">Dónde: <strong>${escapeHtml(opts.location)}</strong></p>`
      : "";

    return await notifyMany(recipientIds, "event_updates", {
      email: {
        subject: `Cambio en "${opts.eventName}"`,
        html: buildEmailHtml({
          bodyHtml: `
            <p style="margin: 0 0 12px; font-size: 18px;"><strong>Atento, que hay cambios</strong> 📅</p>
            <p>Ha cambiado ${what} de <strong style="color: #f59e0b;">"${escapeHtml(
              opts.eventName
            )}"</strong>.</p>
            <p style="margin: 12px 0 0;">Cuándo: <strong>${escapeHtml(when)}</strong></p>
            ${locationHtml}`,
          ctaLabel: "Ver el evento",
          ctaUrl: `${APP_URL}${url}`,
        }),
      },
      push: {
        title: `📅 Cambio en ${opts.eventName}`,
        body: opts.dateChanged
          ? `Nueva fecha: ${when}.`
          : `Nuevo sitio: ${opts.location || "por confirmar"}.`,
        data: { url, eventId: opts.eventId },
      },
    });
  } catch {
    return EMPTY;
  }
}

/* ── group_invitation ─────────────────────────────────────────────────── */

/**
 * Invitación a un grupo para alguien que YA tiene cuenta.
 * El email es exactamente el mismo que se manda a quien no la tiene: lo monta
 * el handler y nos lo pasa hecho, para que no haya dos versiones del texto.
 */
export async function notifyGroupInvitation(opts: {
  userId: string;
  groupId: string;
  groupName: string;
  inviterName: string;
  subject: string;
  html: string;
  inviteUrl: string;
}): Promise<NotifyResult> {
  try {
    return await notifyMany([opts.userId], "group_invitation", {
      email: { subject: opts.subject, html: opts.html },
      push: {
        title: `✉️ ${opts.inviterName} te invita a un grupo`,
        body: `Únete a "${opts.groupName}" en BG Planner.`,
        // Quien ya tiene cuenta puede ir directo al grupo desde la app.
        data: { url: `/invite/${opts.inviteUrl}`, groupId: opts.groupId },
      },
    });
  } catch {
    return EMPTY;
  }
}

/* ── photo_added ──────────────────────────────────────────────────────── */

/** Fotos nuevas en la galería de un grupo. */
export async function notifyGroupPhotosAdded(opts: {
  groupId: string;
  actorUserId: string;
  photoCount: number;
}): Promise<NotifyResult> {
  try {
    const [group, actor, recipientIds] = await Promise.all([
      prisma.group.findUnique({
        where: { id: opts.groupId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: opts.actorUserId },
        select: { name: true, displayName: true, email: true },
      }),
      otherGroupMemberIds(opts.groupId, opts.actorUserId),
    ]);
    if (!group || !actor || recipientIds.length === 0) return EMPTY;

    const actorName = displayNameOf(actor);
    const many = opts.photoCount > 1;
    const what = many ? `${opts.photoCount} fotos` : "una foto";
    const url = `/groups/${opts.groupId}?tab=gallery`;

    return await notifyMany(recipientIds, "photo_added", {
      email: {
        subject: `${actorName} ha subido ${what} a "${group.name}"`,
        html: buildEmailHtml({
          bodyHtml: `
            <p style="margin: 0 0 12px; font-size: 18px;"><strong>Hay fotos nuevas</strong> 📷</p>
            <p><strong>${escapeHtml(actorName)}</strong> ha subido ${what} a la galería de
            <strong style="color: #f59e0b;">"${escapeHtml(group.name)}"</strong>.</p>`,
          ctaLabel: "Ver la galería",
          ctaUrl: `${APP_URL}${url}`,
        }),
      },
      push: {
        title: `📷 Fotos nuevas en ${group.name}`,
        body: `${actorName} ha subido ${what} a la galería.`,
        data: { url, groupId: opts.groupId },
      },
    });
  } catch {
    return EMPTY;
  }
}

/** Fotos nuevas en la galería de un evento. */
export async function notifyEventPhotosAdded(opts: {
  eventId: string;
  eventName: string;
  actorUserId: string;
  photoCount: number;
}): Promise<NotifyResult> {
  try {
    const [actor, recipientIds] = await Promise.all([
      prisma.user.findUnique({
        where: { id: opts.actorUserId },
        select: { name: true, displayName: true, email: true },
      }),
      otherEventAttendeeIds(opts.eventId, opts.actorUserId),
    ]);
    if (!actor || recipientIds.length === 0) return EMPTY;

    const actorName = displayNameOf(actor);
    const many = opts.photoCount > 1;
    const what = many ? `${opts.photoCount} fotos` : "una foto";
    const url = `/events/${opts.eventId}`;

    return await notifyMany(recipientIds, "photo_added", {
      email: {
        subject: `${actorName} ha subido ${what} de "${opts.eventName}"`,
        html: buildEmailHtml({
          bodyHtml: `
            <p style="margin: 0 0 12px; font-size: 18px;"><strong>Hay fotos nuevas</strong> 📷</p>
            <p><strong>${escapeHtml(actorName)}</strong> ha subido ${what} a la galería de
            <strong style="color: #f59e0b;">"${escapeHtml(opts.eventName)}"</strong>.</p>`,
          ctaLabel: "Ver la galería",
          ctaUrl: `${APP_URL}${url}`,
        }),
      },
      push: {
        title: `📷 Fotos nuevas de ${opts.eventName}`,
        body: `${actorName} ha subido ${what} a la galería.`,
        data: { url, eventId: opts.eventId },
      },
    });
  } catch {
    return EMPTY;
  }
}

/* ── game_activity ────────────────────────────────────────────────────── */

/**
 * Alguien ha votado o comentado un juego: avisa a quien lo añadió al grupo.
 *
 * Se llama con el `groupGameId`; de ahí sale quién lo añadió. Si el que vota o
 * comenta es esa misma persona no se manda nada: nadie quiere que le avisen de
 * lo que acaba de hacer él.
 */
export async function notifyGameActivity(opts: {
  groupId: string;
  groupGameId: string;
  gameName: string;
  actorUserId: string;
  kind: "vote" | "comment";
  /** Texto del comentario, solo para el aviso de comentario. */
  comment?: string;
}): Promise<NotifyResult> {
  try {
    const groupGame = await prisma.groupGame.findUnique({
      where: { id: opts.groupGameId },
      select: { addedById: true },
    });
    if (!groupGame || groupGame.addedById === opts.actorUserId) return EMPTY;

    const [group, actor] = await Promise.all([
      prisma.group.findUnique({
        where: { id: opts.groupId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: opts.actorUserId },
        select: { name: true, displayName: true, email: true },
      }),
    ]);
    if (!group || !actor) return EMPTY;

    const actorName = displayNameOf(actor);
    const url = `/groups/${opts.groupId}?tab=ranking`;
    const isComment = opts.kind === "comment";
    const action = isComment ? "ha comentado" : "ha votado";
    const quoted = opts.comment ? `"${opts.comment}"` : "";

    return await notifyMany([groupGame.addedById], "game_activity", {
      email: {
        subject: `${actorName} ${action} "${opts.gameName}"`,
        html: buildEmailHtml({
          bodyHtml: `
            <p style="margin: 0 0 12px; font-size: 18px;"><strong>Movimiento en tu juego</strong> 🎲</p>
            <p><strong>${escapeHtml(actorName)}</strong> ${action}
            <strong style="color: #f59e0b;">"${escapeHtml(opts.gameName)}"</strong>,
            que añadiste tú a <strong>"${escapeHtml(group.name)}"</strong>.</p>
            ${
              quoted
                ? `<blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #f59e0b; background: #1e293b; color: #e2e8f0; font-style: italic; border-radius: 4px;">${escapeHtml(
                    quoted
                  )}</blockquote>`
                : ""
            }`,
          ctaLabel: "Ver el ranking",
          ctaUrl: `${APP_URL}${url}`,
        }),
      },
      push: {
        title: `🎲 ${actorName} ${action} "${opts.gameName}"`,
        body: quoted || `Un juego que añadiste tú a ${group.name}.`,
        data: { url, groupId: opts.groupId },
      },
    });
  } catch {
    return EMPTY;
  }
}
