import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { deletePhotos, pathFromPublicUrl } from "./supabaseStorage";
import { DELETED_USER_NAME, DELETED_USER_ROLE } from "./users";

// Borrar la cuenta desde el perfil (lo exigen App Store y Google Play).
//
// Lo personal se va entero: votos, colección, amigos, avisos, dispositivos,
// códigos de acceso, el email y el nombre. Lo que forma parte de algo
// compartido (hilos de la Comunidad, opiniones, comentarios, fotos de las
// galerías, juegos añadidos a un grupo…) se queda, pero pasa a un usuario
// «fantasma» que se crea para cada cuenta borrada: sin email real, sin BGG y
// con el nombre «Usuario eliminado». Uno por cuenta, y no uno compartido, para
// no chocar con los únicos de GameComment y EventReview (uno por persona).
//
// La fila original se borra de verdad, así que una sesión que siguiera
// abierta en otro dispositivo deja de servir: ya no hay usuario detrás.
//
// Grupos y eventos que lleva la persona pasan a quien más tiempo lleva en
// ellos (un admin si lo hay). Si no queda nadie más, se borran.

// Del activity log, lo que solo habla de la persona y no le sirve a nadie
// más. El resto (juegos añadidos, partidas, opiniones…) es la historia de
// grupos y eventos ajenos, y se queda a nombre del fantasma.
const PERSONAL_ACTIVITY_TYPES = [
  "vote_cast",
  "vote_changed",
  "vote_removed",
  "email_changed",
  "feedback_sent",
  "feature_voted",
  "friend_added",
  "push_enabled",
  "review_login",
];

// Entradas de otros que guardan el nombre de esta persona en el texto: que un
// admin la hizo admin, o que alguien la añadió a sus amigos.
const ROLE_ACTIVITY_TYPES = ["member_promoted", "member_demoted"];

function personName(u: { displayName: string | null; name: string | null }) {
  return u.displayName || u.name || "Alguien";
}

export interface Handover {
  id: string;
  name: string;
  /** A quién pasa. null = no queda nadie y se borra. */
  heir: { userId: string; name: string } | null;
}

export interface DeletionPlan {
  groups: Handover[];
  events: Handover[];
  /** Lo que se queda anonimizado. */
  kept: {
    posts: number;
    reviews: number;
    comments: number;
    photos: number;
  };
}

/**
 * Qué va a pasar al borrar la cuenta. Lo enseña el modal antes de confirmar
 * y lo vuelve a calcular el borrado, que no se fía de lo que vio el cliente.
 */
export async function getDeletionPlan(userId: string): Promise<DeletionPlan> {
  const [owned, created, threads, replies, gameReviews, eventReviews, comments, groupPhotos, eventPhotos, reviewPhotos] =
    await Promise.all([
      prisma.groupMember.findMany({
        where: { userId, role: "owner" },
        select: {
          group: {
            select: {
              id: true,
              name: true,
              members: {
                where: { userId: { not: userId } },
                orderBy: { joinedAt: "asc" },
                select: {
                  role: true,
                  user: { select: { id: true, name: true, displayName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.event.findMany({
        where: { createdById: userId },
        orderBy: { date: "desc" },
        select: {
          id: true,
          name: true,
          attendees: {
            where: { userId: { not: userId }, status: { not: "cancelled" } },
            orderBy: { joinedAt: "asc" },
            select: {
              role: true,
              user: { select: { id: true, name: true, displayName: true } },
            },
          },
        },
      }),
      prisma.communityThread.count({ where: { authorId: userId, deletedAt: null } }),
      prisma.communityReply.count({ where: { authorId: userId, deletedAt: null } }),
      prisma.gameReview.count({ where: { userId } }),
      prisma.eventReview.count({ where: { userId } }),
      prisma.gameComment.count({ where: { userId, deletedAt: null } }),
      prisma.groupPhoto.count({ where: { userId } }),
      prisma.eventPhoto.count({ where: { userId } }),
      prisma.gameReviewPhoto.count({ where: { review: { userId } } }),
    ]);

  const pickHeir = (people: { role: string; user: { id: string; name: string | null; displayName: string | null } }[]) => {
    const heir = people.find((p) => p.role === "admin") ?? people[0];
    return heir ? { userId: heir.user.id, name: personName(heir.user) } : null;
  };

  return {
    groups: owned.map(({ group }) => ({
      id: group.id,
      name: group.name,
      heir: pickHeir(group.members),
    })),
    events: created.map((e) => ({ id: e.id, name: e.name, heir: pickHeir(e.attendees) })),
    kept: {
      posts: threads + replies,
      reviews: gameReviews + eventReviews,
      comments,
      photos: groupPhotos + eventPhotos + reviewPhotos,
    },
  };
}

export interface DeletionResult {
  ghostId: string;
  plan: DeletionPlan;
}

/**
 * Borra la cuenta. Todo en una transacción: si algo falla (una relación
 * nueva con User que aquí no se ha tenido en cuenta, por ejemplo) no se toca
 * nada. Las fotos de Storage se borran después, cuando ya no hay vuelta atrás.
 */
export async function deleteAccount(
  userId: string,
  opts: { removePhotos: boolean }
): Promise<DeletionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, displayName: true, bggUsername: true },
  });
  if (!user) throw new Error("La cuenta no existe");

  const plan = await getDeletionPlan(userId);
  const doomedGroups = plan.groups.filter((g) => !g.heir).map((g) => g.id);
  const doomedEvents = plan.events.filter((e) => !e.heir).map((e) => e.id);

  // Las URLs se recogen antes: después del borrado ya no hay filas que leer.
  const photoUrls: string[] = [];
  const [groupGallery, groupReviewPhotos, eventGallery, events, feedbacks] = await Promise.all([
    prisma.groupPhoto.findMany({
      where: {
        OR: [
          { groupId: { in: doomedGroups } },
          ...(opts.removePhotos ? [{ userId }] : []),
        ],
      },
      select: { url: true },
    }),
    prisma.gameReviewPhoto.findMany({
      where: {
        OR: [
          { review: { groupGame: { groupId: { in: doomedGroups } } } },
          ...(opts.removePhotos ? [{ review: { userId } }] : []),
        ],
      },
      select: { url: true },
    }),
    prisma.eventPhoto.findMany({
      where: {
        OR: [
          { eventId: { in: doomedEvents } },
          ...(opts.removePhotos ? [{ userId }] : []),
        ],
      },
      select: { url: true },
    }),
    prisma.event.findMany({ where: { id: { in: doomedEvents } }, select: { imageUrl: true } }),
    prisma.feedback.findMany({ where: { userId }, select: { images: true } }),
  ]);
  for (const p of [...groupGallery, ...groupReviewPhotos, ...eventGallery]) photoUrls.push(p.url);
  for (const e of events) if (e.imageUrl) photoUrls.push(e.imageUrl);
  for (const f of feedbacks) photoUrls.push(...f.images);

  // Su colección de BGG solo se borra si nadie más usa ese mismo usuario.
  const bggUsername = user.bggUsername?.trim().toLowerCase() || null;
  const bggShared = bggUsername
    ? (await prisma.user.count({
        where: { id: { not: userId }, bggUsername: { equals: bggUsername, mode: "insensitive" } },
      })) > 0
    : true;

  // Para quitar su nombre de las entradas de otros, acotado a sus grupos,
  // sus eventos y quien la tenía de amiga: un homónimo de otro grupo no se toca.
  const names = [...new Set([user.displayName, user.name, user.email].filter((n): n is string => !!n))];
  const [memberOf, attended, friendOf] = await Promise.all([
    prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
    prisma.eventAttendee.findMany({ where: { userId }, select: { eventId: true } }),
    prisma.friendship.findMany({ where: { friendId: userId }, select: { userId: true } }),
  ]);
  const namedWhere = [
    {
      type: { in: ROLE_ACTIVITY_TYPES },
      key: "targetName",
      OR: [
        { groupId: { in: memberOf.map((m) => m.groupId) } },
        { eventId: { in: attended.map((a) => a.eventId) } },
      ],
    },
    {
      type: { in: ["friend_added"] },
      key: "friendName",
      OR: [{ userId: { in: friendOf.map((f) => f.userId) } }],
    },
  ];

  const ghostId = await prisma.$transaction(
    async (tx) => {
      const ghost = await tx.user.create({
        data: {
          email: `eliminado-${randomUUID()}@deleted.invalid`,
          name: DELETED_USER_NAME,
          displayName: DELETED_USER_NAME,
          role: DELETED_USER_ROLE,
        },
        select: { id: true },
      });

      // 1. Lo que hereda otro y lo que se queda sin nadie
      for (const g of plan.groups) {
        if (!g.heir) continue;
        await tx.groupMember.update({
          where: { groupId_userId: { groupId: g.id, userId: g.heir.userId } },
          data: { role: "owner" },
        });
      }
      for (const e of plan.events) {
        if (!e.heir) continue;
        await tx.event.update({ where: { id: e.id }, data: { createdById: e.heir.userId } });
      }
      if (doomedGroups.length) await tx.group.deleteMany({ where: { id: { in: doomedGroups } } });
      if (doomedEvents.length) await tx.event.deleteMany({ where: { id: { in: doomedEvents } } });

      // 2. Lo personal
      await tx.groupMember.deleteMany({ where: { userId } });
      await tx.eventAttendee.deleteMany({ where: { userId } });
      await tx.vote.deleteMany({ where: { userId } });
      // A mano y no por la cascada: así no depende de cómo quedó la clave
      // ajena en Supabase (la de blockedId llegó a estar como SET NULL).
      await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.otpCode.deleteMany({ where: { email: { equals: user.email, mode: "insensitive" } } });
      await tx.groupInvitation.deleteMany({ where: { email: { equals: user.email, mode: "insensitive" } } });
      if (opts.removePhotos) {
        await tx.groupPhoto.deleteMany({ where: { userId } });
        await tx.eventPhoto.deleteMany({ where: { userId } });
        await tx.gameReviewPhoto.deleteMany({ where: { review: { userId } } });
      }
      if (bggUsername && !bggShared) {
        await tx.collectionGame.deleteMany({ where: { bggUsername } });
        await tx.bggUserGame.deleteMany({ where: { bggUsername } });
      }

      // 3. Lo compartido, a nombre del fantasma
      const to = { userId: ghost.id };
      await tx.gameComment.updateMany({ where: { userId }, data: to });
      await tx.gameReview.updateMany({ where: { userId }, data: to });
      await tx.eventReview.updateMany({ where: { userId }, data: to });
      await tx.groupPhoto.updateMany({ where: { userId }, data: to });
      await tx.eventPhoto.updateMany({ where: { userId }, data: to });
      await tx.groupGame.updateMany({ where: { addedById: userId }, data: { addedById: ghost.id } });
      await tx.eventGame.updateMany({ where: { addedById: userId }, data: { addedById: ghost.id } });
      await tx.gameNight.updateMany({ where: { createdById: userId }, data: { createdById: ghost.id } });
      await tx.gameNightPlayer.updateMany({ where: { userId }, data: to });
      await tx.group.updateMany({ where: { createdById: userId }, data: { createdById: ghost.id } });
      await tx.communityThread.updateMany({ where: { authorId: userId }, data: { authorId: ghost.id } });
      await tx.communityReply.updateMany({ where: { authorId: userId }, data: { authorId: ghost.id } });
      await tx.feature.updateMany({ where: { createdById: userId }, data: { createdById: null } });
      await tx.feedback.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });

      // 4. Activity log: lo suyo, fuera o al fantasma; lo de otros, sin su nombre
      await tx.activityLog.deleteMany({ where: { userId, type: { in: PERSONAL_ACTIVITY_TYPES } } });
      await tx.activityLog.updateMany({ where: { userId }, data: to });
      for (const { type, key, OR } of namedWhere) {
        for (const name of names) {
          const rows = await tx.activityLog.findMany({
            where: { type, OR, metadata: { path: [key], equals: name } },
            select: { id: true, metadata: true },
          });
          for (const row of rows) {
            await tx.activityLog.update({
              where: { id: row.id },
              data: { metadata: { ...(row.metadata as object), [key]: DELETED_USER_NAME } },
            });
          }
        }
      }

      // 5. La cuenta. Lo que queda (colección, amigos, avisos, dispositivos,
      // propuestas del roadmap, cambios de email pendientes) cae en cascada.
      await tx.user.delete({ where: { id: userId } });

      return ghost.id;
    },
    { maxWait: 10_000, timeout: 60_000 }
  );

  const paths = photoUrls.map(pathFromPublicUrl).filter((p): p is string => !!p);
  await deletePhotos(paths).catch(() => {});

  return { ghostId, plan };
}
