import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getGroupType } from "@/lib/groupTypes";

// Lo poco que se puede contar de un grupo o de un evento a quien llega con
// un enlace y no ha iniciado sesión: lo justo para saber dónde ha aterrizado
// y decidir si entra. Nada de miembros, asistentes, juegos ni actividad.

export interface PublicEventInfo {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  imageUrl: string | null;
  visibility: string;
  attendeeCount: number;
  gameCount: number;
  maxAttendees: number | null;
  isPublic: boolean;
}

// Ojo: aquí nunca viaja el código de invitación. Si saliera en la ficha
// pública, cualquiera con el enlace del grupo podría colarse dentro.
export interface PublicGroupInfo {
  id: string;
  name: string;
  type: string;
  memberCount: number;
  gameCount: number;
}

const EVENT_SELECT = {
  id: true,
  name: true,
  date: true,
  endDate: true,
  location: true,
  imageUrl: true,
  visibility: true,
  maxAttendees: true,
  _count: { select: { attendees: true, games: true } },
} as const;

const GROUP_SELECT = {
  id: true,
  name: true,
  type: true,
  inviteEnabled: true,
  _count: { select: { members: true, games: true } },
} as const;

type EventRow = {
  id: string;
  name: string;
  date: Date;
  endDate: Date | null;
  location: string | null;
  imageUrl: string | null;
  visibility: string;
  maxAttendees: number | null;
  _count: { attendees: number; games: number };
};

type GroupRow = {
  id: string;
  name: string;
  type: string;
  inviteEnabled: boolean;
  _count: { members: number; games: number };
};

function toEventInfo(event: EventRow): PublicEventInfo {
  return {
    id: event.id,
    name: event.name,
    date: event.date.toISOString(),
    endDate: event.endDate ? event.endDate.toISOString() : null,
    location: event.location,
    imageUrl: event.imageUrl,
    visibility: event.visibility,
    attendeeCount: event._count.attendees,
    gameCount: event._count.games,
    maxAttendees: event.maxAttendees,
    isPublic: event.visibility === "public",
  };
}

function toGroupInfo(group: GroupRow): PublicGroupInfo {
  return {
    id: group.id,
    name: group.name,
    type: group.type,
    memberCount: group._count.members,
    gameCount: group._count.games,
  };
}

export const getPublicEvent = cache(
  async (eventId: string): Promise<PublicEventInfo | null> => {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: EVENT_SELECT,
    });
    return event ? toEventInfo(event) : null;
  }
);

export const getEventByInviteCode = cache(
  async (code: string): Promise<PublicEventInfo | null> => {
    const event = await prisma.event.findUnique({
      where: { inviteCode: code },
      select: EVENT_SELECT,
    });
    return event ? toEventInfo(event) : null;
  }
);

export const getPublicGroup = cache(
  async (groupId: string): Promise<PublicGroupInfo | null> => {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: GROUP_SELECT,
    });
    return group ? toGroupInfo(group) : null;
  }
);

export const getGroupByInviteCode = cache(
  async (code: string): Promise<PublicGroupInfo | null> => {
    const group = await prisma.group.findUnique({
      where: { inviteCode: code },
      select: GROUP_SELECT,
    });
    // Un enlace desactivado no cuenta nada de su grupo.
    return group && group.inviteEnabled ? toGroupInfo(group) : null;
  }
);

export const getGroupByInviteToken = cache(
  async (token: string): Promise<PublicGroupInfo | null> => {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { token },
      select: { status: true, group: { select: GROUP_SELECT } },
    });
    if (!invitation || invitation.status !== "pending") return null;
    return toGroupInfo(invitation.group);
  }
);

// ── Frases de presentación ──────────────────────────────────────────────
// La misma en la descripción del enlace y en la tarjeta, para que no se
// contradigan.

/** "sábado, 12 de diciembre a las 18:30" */
export function formatEventWhen(dateStr: string): string {
  const fecha = new Date(dateStr);
  const dia = fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hora = fecha.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia} a las ${hora}`;
}

/** "12 dic · Madrid" — la píldora de la tarjeta, que es corta. */
export function eventBadge(event: PublicEventInfo): string {
  const dia = new Date(event.date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  return event.location ? `${dia} · ${event.location}` : dia;
}

export function eventTagline(event: PublicEventInfo): string {
  const cuando = formatEventWhen(event.date);
  const donde = event.location ? ` en ${event.location}` : "";
  const gente =
    event.attendeeCount > 1
      ? ` Ya van ${event.attendeeCount} jugadores.`
      : event.attendeeCount === 1
        ? " Hay una persona apuntada."
        : "";
  return `${cuando}${donde}.${gente}`;
}

export function groupTagline(group: PublicGroupInfo): string {
  const cfg = getGroupType(group.type);
  const miembros = `${group.memberCount} jugador${group.memberCount === 1 ? "" : "es"}`;
  const juegos =
    group.gameCount > 0
      ? ` y ${group.gameCount} juego${group.gameCount === 1 ? "" : "s"} en la mesa`
      : "";
  return `${cfg.label}: ${miembros}${juegos}. Votad vuestros juegos y que salga solo a qué jugar.`;
}
