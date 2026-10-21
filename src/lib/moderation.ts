import { prisma } from "./prisma";
import { isSuperadminRole } from "./auth";
import { deleteAccount } from "./accountDeletion";
import { displayName, profileHref, DELETED_USER_ROLE } from "./users";
import { excerpt } from "./text";
import { getEventParticipation } from "./events";
import { deletePhotos, pathFromPublicUrl } from "./supabaseStorage";
import { AUTO_HIDE_REPORTS, type ReportTargetType } from "./reports";

// Denuncias y bloqueos del lado del servidor. Lo compartido con el cliente
// (motivos, tipos, textos) vive en src/lib/reports.ts.

// Lo que se consulta al leer el foro o al mandar cualquier aviso nunca hace
// fallar eso: si la consulta falla, se sigue como si no hubiera bloqueos ni
// denuncias (también cubre desplegar antes de crear las tablas).
async function softly<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.error("[moderation]", err);
    return fallback;
  }
}

// ── Bloqueos ────────────────────────────────────────────────────────────────

/** A quién ha bloqueado esta persona. Vacío sin sesión. */
export async function getBlockedIds(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await softly(
    () => prisma.userBlock.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
    []
  );
  return rows.map((r) => r.blockedId);
}

export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const row = await softly(
    () =>
      prisma.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        select: { id: true },
      }),
    null
  );
  return !!row;
}

/** De estos destinatarios, quiénes han bloqueado al actor (no les llega nada suyo). */
export async function blockersAmong(actorId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await softly(
    () =>
      prisma.userBlock.findMany({
        where: { blockedId: actorId, blockerId: { in: userIds } },
        select: { blockerId: true },
      }),
    []
  );
  return new Set(rows.map((r) => r.blockerId));
}

// ── Ocultación automática ───────────────────────────────────────────────────

/**
 * Hilos y respuestas de la Comunidad con AUTO_HIDE_REPORTS denuncias
 * pendientes o más (cada una de una persona distinta, por el único de
 * Report): no se enseñan hasta que se revisen. Si se descartan, vuelven.
 */
export async function getAutoHiddenCommunityIds(): Promise<{ threads: Set<string>; replies: Set<string> }> {
  const rows = await softly(
    () =>
      prisma.report.groupBy({
        by: ["targetType", "targetId"],
        where: { status: "pending", targetType: { in: ["thread", "reply"] } },
        _count: { _all: true },
        having: { targetId: { _count: { gte: AUTO_HIDE_REPORTS } } },
      }),
    []
  );
  const threads = new Set<string>();
  const replies = new Set<string>();
  for (const r of rows) (r.targetType === "thread" ? threads : replies).add(r.targetId);
  return { threads, replies };
}

// ── Objetivos de una denuncia ──────────────────────────────────────────────

export interface ReportTargetInfo {
  /** Autor del contenido (o el propio usuario denunciado). */
  authorId: string | null;
  /** Texto corto para la cola de /admin. */
  preview: string | null;
  /** Foto, si lo denunciado es una foto o una opinión con fotos. */
  imageUrl: string | null;
  /** Dónde verlo con la cuenta de superadmin. */
  href: string;
  /** Dónde ha pasado (nombre del hilo, grupo o evento). */
  context: string | null;
  /** Ya retirado o borrado por su autor. */
  gone: boolean;
}

/**
 * Lo que hace falta saber de lo denunciado. Con `viewerId`, además, null si
 * esa persona no puede verlo (no es del grupo, no está en el evento…): no se
 * denuncia lo que no se ve.
 */
export async function describeReportTarget(
  type: ReportTargetType,
  id: string,
  viewerId?: string
): Promise<ReportTargetInfo | null> {
  switch (type) {
    case "thread": {
      const t = await prisma.communityThread.findUnique({
        where: { id },
        select: { id: true, title: true, body: true, authorId: true, deletedAt: true },
      });
      if (!t || (viewerId && t.deletedAt)) return null;
      return {
        authorId: t.authorId,
        preview: `${t.title}\n\n${excerpt(t.body, 400)}`,
        imageUrl: null,
        href: `/community/${t.id}`,
        context: null,
        gone: !!t.deletedAt,
      };
    }
    case "reply": {
      const r = await prisma.communityReply.findUnique({
        where: { id },
        select: {
          id: true,
          body: true,
          authorId: true,
          deletedAt: true,
          thread: { select: { id: true, title: true, deletedAt: true } },
        },
      });
      if (!r || (viewerId && (r.deletedAt || r.thread.deletedAt))) return null;
      return {
        authorId: r.authorId,
        preview: excerpt(r.body, 400),
        imageUrl: null,
        href: `/community/${r.thread.id}#reply-${r.id}`,
        context: `En «${r.thread.title}»`,
        gone: !!r.deletedAt || !!r.thread.deletedAt,
      };
    }
    case "group_photo": {
      const p = await prisma.groupPhoto.findUnique({
        where: { id },
        select: { url: true, userId: true, groupId: true, group: { select: { name: true } } },
      });
      if (!p) return null;
      if (viewerId) {
        const member = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId: p.groupId, userId: viewerId } },
          select: { id: true },
        });
        if (!member) return null;
      }
      return {
        authorId: p.userId,
        preview: null,
        imageUrl: p.url,
        href: `/admin/groups/${p.groupId}`,
        context: `Grupo «${p.group.name}»`,
        gone: false,
      };
    }
    case "event_photo": {
      const p = await prisma.eventPhoto.findUnique({
        where: { id },
        select: { url: true, userId: true, eventId: true, event: { select: { name: true } } },
      });
      if (!p) return null;
      if (viewerId) {
        const part = await getEventParticipation(p.eventId, viewerId);
        if (!part?.canView) return null;
      }
      return {
        authorId: p.userId,
        preview: null,
        imageUrl: p.url,
        href: `/admin/events/${p.eventId}`,
        context: `Evento «${p.event.name}»`,
        gone: false,
      };
    }
    case "review": {
      const r = await prisma.gameReview.findUnique({
        where: { id },
        select: {
          text: true,
          userId: true,
          photos: { select: { url: true }, orderBy: { order: "asc" }, take: 1 },
          groupGame: {
            select: { groupId: true, game: { select: { name: true } }, group: { select: { name: true } } },
          },
        },
      });
      if (!r) return null;
      if (viewerId) {
        const member = await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId: r.groupGame.groupId, userId: viewerId } },
          select: { id: true },
        });
        if (!member) return null;
      }
      return {
        authorId: r.userId,
        preview: r.text ? excerpt(r.text, 400) : null,
        imageUrl: r.photos[0]?.url ?? null,
        href: `/admin/groups/${r.groupGame.groupId}`,
        context: `Opinión de «${r.groupGame.game.name}» en «${r.groupGame.group.name}»`,
        gone: false,
      };
    }
    case "user": {
      const u = await prisma.user.findUnique({
        where: { id },
        select: { id: true, slug: true, role: true, displayName: true, name: true, location: true },
      });
      if (!u || (viewerId && u.role === DELETED_USER_ROLE)) return null;
      return {
        authorId: u.id,
        preview: [displayName(u, ""), u.location].filter(Boolean).join(" · ") || null,
        imageUrl: null,
        href: profileHref(u),
        context: null,
        gone: u.role === DELETED_USER_ROLE,
      };
    }
    case "game_manual": {
      const g = await prisma.game.findUnique({
        where: { id },
        select: { bggId: true, name: true, manualUrl: true, manualAddedById: true },
      });
      if (!g || (viewerId && !g.manualUrl)) return null;
      return {
        authorId: g.manualAddedById,
        preview: g.manualUrl,
        imageUrl: null,
        href: g.manualUrl ?? `https://boardgamegeek.com/boardgame/${g.bggId}`,
        context: `Manual de «${g.name}»`,
        gone: !g.manualUrl,
      };
    }
  }
}

/**
 * Retira lo denunciado con el mismo borrado que ya existía: lógico para hilos
 * y respuestas (quedan en la BD con `deletedAt`), de verdad para fotos y
 * opiniones (y sus ficheros en Storage). Un usuario no se retira desde aquí.
 */
export async function removeReportTarget(type: ReportTargetType, id: string): Promise<void> {
  switch (type) {
    case "thread":
      await prisma.communityThread.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
      return;
    case "reply":
      await prisma.communityReply.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
      return;
    case "group_photo": {
      const photo = await prisma.groupPhoto.findUnique({ where: { id }, select: { url: true } });
      if (!photo) return;
      await prisma.groupPhoto.delete({ where: { id } });
      const path = pathFromPublicUrl(photo.url);
      if (path) deletePhotos([path]).catch(() => {});
      return;
    }
    case "event_photo": {
      const photo = await prisma.eventPhoto.findUnique({ where: { id }, select: { url: true } });
      if (!photo) return;
      await prisma.eventPhoto.delete({ where: { id } });
      const path = pathFromPublicUrl(photo.url);
      if (path) deletePhotos([path]).catch(() => {});
      return;
    }
    case "review": {
      const review = await prisma.gameReview.findUnique({
        where: { id },
        select: { photos: { select: { url: true } } },
      });
      if (!review) return;
      // Cascade borra las fotos en la BD; aquí se limpia Storage.
      await prisma.gameReview.delete({ where: { id } });
      const paths = review.photos.map((p) => pathFromPublicUrl(p.url)).filter((p): p is string => !!p);
      deletePhotos(paths).catch(() => {});
      return;
    }
    case "user":
      return;
    case "game_manual":
      await prisma.game.updateMany({
        where: { id },
        data: { manualUrl: null, manualAddedById: null, manualAddedAt: null },
      });
      return;
  }
}

/** Quien recibe los avisos de denuncias: los superadmin (o el del env). */
export async function moderatorIds(): Promise<string[]> {
  const fallback = process.env.SUPERADMIN_EMAIL;
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { role: "superadmin" },
        ...(fallback ? [{ email: { equals: fallback, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// ── Expulsiones ─────────────────────────────────────────────────────────────

export const BANNED_MESSAGE =
  "Esta cuenta se cerró por incumplir los términos de uso de BG Planner. Si crees que es un error, escríbenos desde Contacto.";

/**
 * Si este email está expulsado. Si la consulta falla (por ejemplo, la tabla
 * aún no existe), se deja pasar: mejor no dejar a nadie fuera por un error.
 */
export async function isEmailBanned(email: string): Promise<boolean> {
  const row = await softly(
    () => prisma.bannedEmail.findUnique({ where: { email: email.trim().toLowerCase() }, select: { email: true } }),
    null
  );
  return !!row;
}

export class ExpelError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Expulsa a alguien: veta su email, cierra las denuncias pendientes contra él
 * (antes de borrar, que después ya no se sabe que eran suyas) y borra la
 * cuenta igual que si la borrara él mismo, así que sus sesiones abiertas
 * dejan de servir. Con removeContent se retiran además sus hilos y
 * respuestas de la Comunidad y todas sus fotos; lo demás que compartió
 * (opiniones, comentarios) queda como «Usuario eliminado».
 */
export async function expelUser(
  userId: string,
  adminId: string,
  opts: { removeContent: boolean; reason: string }
): Promise<{ email: string; name: string | null }> {
  if (userId === adminId) throw new ExpelError("No puedes expulsarte a ti mismo", 400);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, displayName: true, role: true },
  });
  if (!user) throw new ExpelError("Esa cuenta ya no existe", 404);
  if (user.role === DELETED_USER_ROLE) throw new ExpelError("Esa cuenta ya está borrada", 400);
  if (isSuperadminRole(user.role, user.email)) throw new ExpelError("No se puede expulsar a un superadmin", 400);

  const email = user.email.trim().toLowerCase();
  const name = displayName(user, "") || null;
  const now = new Date();

  await prisma.bannedEmail.upsert({
    where: { email },
    create: { email, name, reason: opts.reason, bannedById: adminId },
    update: { name, reason: opts.reason, bannedById: adminId, createdAt: now },
  });
  await prisma.report.updateMany({
    where: { targetUserId: userId, status: "pending" },
    data: { status: "resolved", resolvedById: adminId, resolvedAt: now },
  });
  if (opts.removeContent) {
    await prisma.communityThread.updateMany({ where: { authorId: userId, deletedAt: null }, data: { deletedAt: now } });
    await prisma.communityReply.updateMany({ where: { authorId: userId, deletedAt: null }, data: { deletedAt: now } });
  }
  await deleteAccount(userId, { removePhotos: opts.removeContent });

  return { email, name };
}
