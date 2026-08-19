import { prisma } from "./prisma";

// ─────────────────────────────────────────────────────────────────────────
// Moderación: bloqueos entre personas y resolución de contenido denunciado.
//
// La directriz 1.2 de Apple exige que se pueda denunciar contenido y
// bloquear personas, y que el bloqueo tenga efecto real. Todo lo que filtre
// contenido por bloqueos debe pasar por getBlockedUserIds() para no duplicar
// la query ni olvidarse de un sentido de la relación.
// ─────────────────────────────────────────────────────────────────────────

export const REPORT_TARGET_TYPES = ["photo", "review", "comment", "user"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "offensive",
  "sexual",
  "harassment",
  "spam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  offensive: "Contenido ofensivo o violento",
  sexual: "Contenido sexual o inapropiado",
  harassment: "Acoso hacia una persona",
  spam: "Spam o publicidad",
  other: "Otro motivo",
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  photo: "Foto",
  review: "Opinión",
  comment: "Comentario",
  user: "Persona",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  actioned: "Resuelta",
  dismissed: "Descartada",
};

/**
 * Ids de las personas cuyo contenido NO debe ver `userId`.
 *
 * El filtro es simétrico a propósito: si A bloquea a B, ninguno de los dos ve
 * el contenido del otro. Así el bloqueo no se convierte en un canal de acoso
 * unidireccional (la persona bloqueada seguiría viendo y respondiendo a quien
 * la bloqueó).
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });

  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }
  return [...ids];
}

/** ¿Hay un bloqueo (en cualquier sentido) entre estas dos personas? */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!block;
}

// ── Resolución del objeto denunciado ────────────────────────────────────

export interface ReportTarget {
  /** Autor del contenido (o la propia persona denunciada si targetType = "user"). */
  ownerId: string;
  ownerName: string;
  /** Descripción corta del tipo concreto, para el email y el panel de admin. */
  kindLabel: string;
  /** Texto o URL del contenido, ya recortado. Sin escapar: escapar al pintarlo. */
  snippet: string;
  /** Contexto para comprobar acceso: uno de los dos, o ninguno para "user". */
  groupId?: string;
  eventId?: string;
}

const SNIPPET_MAX = 300;

function shorten(text: string | null | undefined): string {
  if (!text) return "(sin texto)";
  const clean = text.trim();
  return clean.length > SNIPPET_MAX ? `${clean.slice(0, SNIPPET_MAX)}…` : clean;
}

function personName(u: {
  displayName: string | null;
  name: string | null;
  email: string;
}): string {
  return u.displayName || u.name || u.email;
}

const USER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  email: true,
} as const;

async function resolvePhoto(targetId: string): Promise<ReportTarget | null> {
  const groupPhoto = await prisma.groupPhoto.findUnique({
    where: { id: targetId },
    select: { url: true, caption: true, groupId: true, user: { select: USER_SELECT } },
  });
  if (groupPhoto) {
    return {
      ownerId: groupPhoto.user.id,
      ownerName: personName(groupPhoto.user),
      kindLabel: "Foto de la galería de un grupo",
      snippet: groupPhoto.caption ? `${groupPhoto.caption} — ${groupPhoto.url}` : groupPhoto.url,
      groupId: groupPhoto.groupId,
    };
  }

  const eventPhoto = await prisma.eventPhoto.findUnique({
    where: { id: targetId },
    select: { url: true, caption: true, eventId: true, user: { select: USER_SELECT } },
  });
  if (eventPhoto) {
    return {
      ownerId: eventPhoto.user.id,
      ownerName: personName(eventPhoto.user),
      kindLabel: "Foto de la galería de un evento",
      snippet: eventPhoto.caption ? `${eventPhoto.caption} — ${eventPhoto.url}` : eventPhoto.url,
      eventId: eventPhoto.eventId,
    };
  }

  const reviewPhoto = await prisma.gameReviewPhoto.findUnique({
    where: { id: targetId },
    select: {
      url: true,
      review: {
        select: {
          user: { select: USER_SELECT },
          groupGame: { select: { groupId: true } },
        },
      },
    },
  });
  if (reviewPhoto) {
    return {
      ownerId: reviewPhoto.review.user.id,
      ownerName: personName(reviewPhoto.review.user),
      kindLabel: "Foto de una opinión",
      snippet: reviewPhoto.url,
      groupId: reviewPhoto.review.groupGame.groupId,
    };
  }

  return null;
}

async function resolveReview(targetId: string): Promise<ReportTarget | null> {
  const gameReview = await prisma.gameReview.findUnique({
    where: { id: targetId },
    select: {
      text: true,
      user: { select: USER_SELECT },
      groupGame: { select: { groupId: true, game: { select: { name: true } } } },
    },
  });
  if (gameReview) {
    return {
      ownerId: gameReview.user.id,
      ownerName: personName(gameReview.user),
      kindLabel: `Opinión sobre "${gameReview.groupGame.game.name}"`,
      snippet: shorten(gameReview.text),
      groupId: gameReview.groupGame.groupId,
    };
  }

  const eventReview = await prisma.eventReview.findUnique({
    where: { id: targetId },
    select: {
      text: true,
      eventId: true,
      user: { select: USER_SELECT },
      event: { select: { name: true } },
    },
  });
  if (eventReview) {
    return {
      ownerId: eventReview.user.id,
      ownerName: personName(eventReview.user),
      kindLabel: `Valoración del evento "${eventReview.event.name}"`,
      snippet: shorten(eventReview.text),
      eventId: eventReview.eventId,
    };
  }

  return null;
}

async function resolveComment(targetId: string): Promise<ReportTarget | null> {
  const comment = await prisma.gameComment.findUnique({
    where: { id: targetId },
    select: {
      text: true,
      user: { select: USER_SELECT },
      groupGame: { select: { groupId: true, game: { select: { name: true } } } },
    },
  });
  if (!comment) return null;

  return {
    ownerId: comment.user.id,
    ownerName: personName(comment.user),
    kindLabel: `Comentario en "${comment.groupGame.game.name}"`,
    snippet: shorten(comment.text),
    groupId: comment.groupGame.groupId,
  };
}

async function resolveUser(targetId: string): Promise<ReportTarget | null> {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: USER_SELECT,
  });
  if (!user) return null;

  return {
    ownerId: user.id,
    ownerName: personName(user),
    kindLabel: "Persona",
    snippet: `${personName(user)} (${user.email})`,
  };
}

/**
 * Localiza el objeto denunciado en la tabla que toque. Devuelve null si ya no
 * existe (el contenido puede haberse borrado antes de que llegue la denuncia).
 */
export async function resolveReportTarget(
  targetType: ReportTargetType,
  targetId: string
): Promise<ReportTarget | null> {
  switch (targetType) {
    case "photo":
      return resolvePhoto(targetId);
    case "review":
      return resolveReview(targetId);
    case "comment":
      return resolveComment(targetId);
    case "user":
      return resolveUser(targetId);
    default:
      return null;
  }
}

/**
 * ¿Puede `viewerId` ver el objeto que quiere denunciar? Solo se aceptan
 * denuncias de contenido al que la persona tiene acceso de verdad; si no,
 * cualquiera podría sondear ids ajenos.
 */
export async function canAccessReportTarget(
  viewerId: string,
  targetType: ReportTargetType,
  target: ReportTarget
): Promise<boolean> {
  if (target.groupId) {
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: target.groupId, userId: viewerId } },
      select: { id: true },
    });
    return !!membership;
  }

  if (target.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: target.eventId },
      select: { visibility: true, createdById: true },
    });
    if (!event) return false;
    if (event.visibility === "public" || event.createdById === viewerId) return true;
    const attendee = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: target.eventId, userId: viewerId } },
      select: { id: true },
    });
    return !!attendee;
  }

  if (targetType === "user") {
    // Solo se puede denunciar a alguien con quien se comparte grupo o evento.
    const [sharedGroup, sharedEvent] = await Promise.all([
      prisma.groupMember.findFirst({
        where: {
          userId: target.ownerId,
          group: { members: { some: { userId: viewerId } } },
        },
        select: { id: true },
      }),
      prisma.eventAttendee.findFirst({
        where: {
          userId: target.ownerId,
          event: {
            OR: [
              { attendees: { some: { userId: viewerId } } },
              { createdById: viewerId },
            ],
          },
        },
        select: { id: true },
      }),
    ]);
    return !!sharedGroup || !!sharedEvent;
  }

  return false;
}
