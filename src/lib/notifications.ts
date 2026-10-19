import { after } from "next/server";
import { prisma } from "./prisma";
import { profileHref } from "./users";
import { deliverPush, type PushPayload } from "./push";
import { blockersAmong } from "./moderation";

// Notificaciones dentro de la web: lo que le pasa a alguien y no merece un
// email. Se crean con `notify` (fire-and-forget, como logActivity) y se
// sirven con `presentNotification`, que compone el texto y el enlace.

export type NotificationType =
  | "friend_added"
  | "group_member_joined"
  | "group_role_changed"
  | "group_pinged"
  | "super_vote_freed"
  | "event_attendee_joined"
  | "event_role_changed"
  | "event_game_added"
  | "event_geeklist_games"
  | "review_games"
  | "review_event"
  | "community_reply"
  | "community_participant_reply"
  | "report_created"
  | "group_inherited"
  | "event_inherited";

// Las que pueden llegar en ráfaga (un admin añade diez juegos seguidos) se
// funden en una sola mientras siga sin leer: se acumulan los juegos y sube
// arriba. Así una tarde de trabajo en un evento no son diez avisos.
const MERGEABLE = new Set<NotificationType>(["event_game_added", "event_geeklist_games"]);
const MERGE_WINDOW_MS = 12 * 60 * 60 * 1000;
const MAX_MERGED_GAMES = 20;

// Respuestas en un hilo de la Comunidad: un solo aviso por hilo mientras siga
// sin leer, sin importar quién responda («Marta y 2 más han respondido…»). El
// enlace apunta a la primera respuesta que aún no has visto.
const THREAD_MERGEABLE = new Set<NotificationType>([
  "community_reply",
  "community_participant_reply",
]);

// Denuncias nuevas para quien modera: una sola entrada mientras siga sin leer
// («Tienes 3 denuncias nuevas»), que apunta a la cola de /admin.
const REPORT_MERGEABLE = new Set<NotificationType>(["report_created"]);

// Un aviso fundido vuelve a sonar en el móvil solo si el anterior push del
// mismo aviso tiene ya este tiempo: diez respuestas seguidas en un hilo son
// un push, no diez. Entre medias se actualiza en la campana sin hacer ruido.
const PUSH_MERGE_COOLDOWN_MS = 15 * 60 * 1000;

// Las de más de esto se borran en el cron diario.
export const NOTIFICATION_TTL_DAYS = 90;

type Meta = Record<string, unknown>;

interface NotifyInput {
  /** Destinatarios. Quien la provoca se descarta solo. */
  userIds: string[];
  actorId?: string | null;
  type: NotificationType;
  groupId?: string | null;
  eventId?: string | null;
  metadata?: Meta;
}

/** La notificación creada o actualizada, y si merece push. */
async function createOrMerge(
  userId: string,
  input: NotifyInput
): Promise<{ id: string; push: boolean }> {
  const base = {
    userId,
    actorId: input.actorId ?? null,
    type: input.type,
    groupId: input.groupId ?? null,
    eventId: input.eventId ?? null,
  };
  let metadata = (input.metadata ?? {}) as Meta;

  if (THREAD_MERGEABLE.has(input.type) && typeof metadata.threadId === "string") {
    const previous = await prisma.notification.findFirst({
      where: {
        userId,
        type: input.type,
        readAt: null,
        metadata: { path: ["threadId"], equals: metadata.threadId },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true, createdAt: true },
    });
    const actorId = input.actorId ?? null;
    if (previous) {
      const prev = (previous.metadata ?? {}) as Meta;
      const prevActors = Array.isArray(prev.actorIds) ? (prev.actorIds as string[]) : [];
      const actorIds = [...new Set([...prevActors, ...(actorId ? [actorId] : [])])];
      await prisma.notification.update({
        where: { id: previous.id },
        data: {
          actorId,
          // `replyId` se queda el de la primera: ahí empieza lo que no has leído.
          metadata: {
            ...prev,
            threadTitle: metadata.threadTitle ?? prev.threadTitle,
            actorIds,
            replies: (typeof prev.replies === "number" ? prev.replies : 1) + 1,
          } as object,
          createdAt: new Date(),
        },
      });
      return { id: previous.id, push: pushAgain(previous.createdAt) };
    }
    metadata = { ...metadata, actorIds: actorId ? [actorId] : [], replies: 1 };
  }

  if (REPORT_MERGEABLE.has(input.type)) {
    const previous = await prisma.notification.findFirst({
      where: { userId, type: input.type, readAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true, createdAt: true },
    });
    if (previous) {
      const prev = (previous.metadata ?? {}) as Meta;
      await prisma.notification.update({
        where: { id: previous.id },
        data: {
          actorId: input.actorId ?? null,
          metadata: {
            ...metadata,
            count: (typeof prev.count === "number" ? prev.count : 1) + 1,
          } as object,
          createdAt: new Date(),
        },
      });
      return { id: previous.id, push: pushAgain(previous.createdAt) };
    }
    metadata = { ...metadata, count: 1 };
  }

  if (MERGEABLE.has(input.type)) {
    const previous = await prisma.notification.findFirst({
      where: {
        ...base,
        readAt: null,
        createdAt: { gte: new Date(Date.now() - MERGE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true, createdAt: true },
    });
    if (previous) {
      const prev = (previous.metadata ?? {}) as Meta;
      const games = [
        ...(Array.isArray(prev.games) ? (prev.games as Meta[]) : []),
        ...(Array.isArray(metadata.games) ? (metadata.games as Meta[]) : []),
      ];
      const seen = new Set<string>();
      const unique = games.filter((g) => {
        const key = String(g.name ?? "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Si traen `count` (cuántos son en total, aunque solo se guarden unos
      // pocos), se suman: «y 82 más» tiene que seguir siendo verdad.
      const prevCount = typeof prev.count === "number" ? prev.count : null;
      const newCount = typeof metadata.count === "number" ? metadata.count : null;
      const count =
        prevCount !== null || newCount !== null
          ? (prevCount ?? (Array.isArray(prev.games) ? prev.games.length : 0)) +
            (newCount ?? (Array.isArray(metadata.games) ? metadata.games.length : 0))
          : undefined;
      await prisma.notification.update({
        where: { id: previous.id },
        data: {
          metadata: {
            ...prev,
            ...metadata,
            games: unique.slice(-MAX_MERGED_GAMES),
            ...(count !== undefined ? { count } : {}),
          } as object,
          createdAt: new Date(),
        },
      });
      return { id: previous.id, push: pushAgain(previous.createdAt) };
    }
  }

  const created = await prisma.notification.create({
    data: { ...base, metadata: metadata as object },
    select: { id: true },
  });
  return { id: created.id, push: true };
}

// `createdAt` de un aviso fundido es la última vez que se actualizó (y sonó).
function pushAgain(lastUpdate: Date) {
  return Date.now() - lastUpdate.getTime() >= PUSH_MERGE_COOLDOWN_MS;
}

/** El aviso tal cual sale en la campana, en forma de push. */
async function pushPayload(notificationId: string, userId: string): Promise<PushPayload> {
  const [row, unread] = await Promise.all([
    prisma.notification.findUnique({ where: { id: notificationId }, select: NOTIFICATION_SELECT }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  if (!row) return { title: "BG Planner", body: "Tienes una novedad", url: "/notifications", unread };
  const n = presentNotification(row);
  const text = n.parts.map((p) => p.text).join("");
  return {
    // Arriba, dónde ha pasado; debajo, qué ha pasado
    title:
      row.group?.name ??
      row.event?.name ??
      (n.type.startsWith("community_") ? "Comunidad" : n.type.startsWith("report_") ? "Moderación" : "BG Planner"),
    body: `${n.emoji} ${text}`,
    url: n.href,
    tag: notificationId,
    unread,
  };
}

/** Avisa y espera a que quede guardado (para el cron, que no puede soltarlo). */
export async function notifyNow(input: NotifyInput): Promise<number> {
  let recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
  // A quien ha bloqueado al actor no le llega nada suyo: ni campana ni push.
  // Tampoco en los grupos y eventos que compartan. Las denuncias sí llegan
  // siempre a quien modera.
  if (input.actorId && recipients.length > 0 && input.type !== "report_created") {
    const blockers = await blockersAmong(input.actorId, recipients);
    if (blockers.size > 0) recipients = recipients.filter((id) => !blockers.has(id));
  }
  await Promise.all(
    recipients.map(async (userId) => {
      const { id, push } = await createOrMerge(userId, input);
      if (push) await deliverPush(userId, () => pushPayload(id, userId));
    })
  );
  return recipients.length;
}

/**
 * Avisa a cada destinatario. Nunca bloquea ni hace fallar la respuesta: se
 * hace con `after`, que deja terminar el trabajo después de responder (sin
 * él, en Vercel la función se congela al responder y el push podía perderse).
 */
export function notify(input: NotifyInput) {
  inBackground(() => notifyNow(input));
}

/** Trabajo para después de responder (avisos que necesitan consultas antes). */
export function inBackground(task: () => Promise<unknown>) {
  const run = () => task().catch(() => {});
  try {
    after(run);
  } catch {
    // Fuera de una petición (scripts): a la antigua
    void run();
  }
}

// ── Presentación ────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  type: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
  groupId: string | null;
  eventId: string | null;
  actor: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    slug: string | null;
  } | null;
  group: { id: string; name: string } | null;
  event: { id: string; name: string } | null;
}

export interface PresentedNotification {
  id: string;
  type: string;
  emoji: string;
  /** Trozos de texto; los `strong` van resaltados. */
  parts: { text: string; strong?: boolean }[];
  href: string;
  thumbnail: string | null;
  actor: { name: string; avatarUrl: string | null } | null;
  read: boolean;
  createdAt: string;
}

export const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  metadata: true,
  readAt: true,
  createdAt: true,
  groupId: true,
  eventId: true,
  actor: { select: { id: true, name: true, displayName: true, avatarUrl: true, slug: true } },
  group: { select: { id: true, name: true } },
  event: { select: { id: true, name: true } },
} as const;

// `total`: cuántos son de verdad, si en `games` solo van los primeros.
function gameList(games: Meta[], total?: unknown): { text: string; strong?: boolean }[] {
  const names = games.map((g) => String(g.name ?? "")).filter(Boolean);
  if (names.length === 0) return [{ text: "un juego" }];
  const shown = names.slice(0, 2);
  const rest = Math.max(typeof total === "number" ? total : names.length, names.length) - shown.length;
  const out: { text: string; strong?: boolean }[] = [];
  shown.forEach((n, i) => {
    if (i > 0) out.push({ text: i === shown.length - 1 && rest === 0 ? " y " : ", " });
    out.push({ text: `«${n}»`, strong: true });
  });
  if (rest > 0) out.push({ text: ` y ${rest} más` });
  return out;
}

export function presentNotification(n: NotificationRow): PresentedNotification {
  const m = (n.metadata ?? {}) as Meta;
  const actorName = n.actor ? n.actor.displayName || n.actor.name || "Alguien" : null;
  const actor = { text: actorName ?? "Alguien", strong: true };
  const groupName = { text: n.group?.name ?? "tu grupo", strong: true };
  const eventName = { text: n.event?.name ?? "el evento", strong: true };
  const groupHref = n.groupId ? `/groups/${n.groupId}` : "/groups";
  const eventHref = n.eventId ? `/events/${n.eventId}` : "/events";
  const games = Array.isArray(m.games) ? (m.games as Meta[]) : [];
  const firstThumb = games.find((g) => typeof g.thumbnail === "string")?.thumbnail as string | undefined;

  let emoji = "🔔";
  let parts: PresentedNotification["parts"] = [];
  let href = "/";

  switch (n.type) {
    case "friend_added":
      emoji = "🤝";
      parts = [actor, { text: " te ha añadido a sus amigos" }];
      href = n.actor ? profileHref(n.actor) : "/";
      break;
    case "group_member_joined":
      emoji = "👋";
      parts = [actor, { text: " se ha unido a " }, groupName];
      href = `${groupHref}?tab=members`;
      break;
    case "group_role_changed":
      emoji = "🛡️";
      parts =
        m.role === "admin"
          ? [actor, { text: " te ha hecho admin de " }, groupName]
          : [{ text: "Ya no eres admin de " }, groupName, { text: ", sigues como miembro" }];
      href = `${groupHref}?tab=members`;
      break;
    case "group_pinged":
      emoji = "📯";
      parts = [actor, { text: " convoca a " }, groupName, { text: " para votar" }];
      href = groupHref;
      break;
    case "super_vote_freed":
      emoji = "🔥";
      parts = [
        { text: "Vuelves a tener tu super voto en " },
        groupName,
        { text: ": " },
        { text: `«${String(m.gameName ?? "un juego")}»`, strong: true },
        { text: " ya se ha jugado" },
      ];
      href = groupHref;
      break;
    case "event_attendee_joined":
      emoji = "🙋";
      parts = [actor, { text: m.status === "maybe" ? " quizás vaya a " : " se ha apuntado a " }, eventName];
      href = `${eventHref}?tab=attendees`;
      break;
    case "event_role_changed":
      emoji = "🛡️";
      parts =
        m.role === "admin"
          ? [actor, { text: " te ha hecho admin de " }, eventName]
          : [{ text: "Ya no eres admin de " }, eventName];
      href = `${eventHref}?tab=attendees`;
      break;
    case "event_game_added":
      emoji = "🎲";
      parts = [actor, { text: " ha añadido " }, ...gameList(games), { text: " a " }, eventName];
      href = `${eventHref}?tab=games`;
      break;
    case "event_geeklist_games":
      emoji = "📋";
      parts = [
        { text: Math.max(Number(m.count) || 0, games.length) === 1 ? "Llega " : "Llegan " },
        ...gameList(games, m.count),
        { text: " a la ludoteca de " },
        eventName,
      ];
      href = `${eventHref}?tab=games`;
      break;
    case "review_games": {
      emoji = "⭐";
      parts = [{ text: "¿Qué tal ayer en " }, groupName, { text: "? Valora " }, ...gameList(games)];
      const first = games[0]?.id;
      href = first ? `${groupHref}?review=${encodeURIComponent(String(first))}` : groupHref;
      break;
    }
    case "review_event":
      emoji = "🎉";
      parts = [eventName, { text: " ya ha terminado. ¿Qué tal fue? Valóralo y sube tus fotos" }];
      href = `${eventHref}?review=1`;
      break;
    case "community_reply":
    case "community_participant_reply": {
      emoji = "💬";
      const others = Math.max(0, (Array.isArray(m.actorIds) ? m.actorIds.length : 1) - 1);
      const many = others > 0;
      const title = { text: `«${String(m.threadTitle ?? "un hilo")}»`, strong: true };
      parts = [
        actor,
        ...(many ? [{ text: ` y ${others} más` }] : []),
        n.type === "community_reply"
          ? { text: many ? " han respondido a tu hilo " : " ha respondido a tu hilo " }
          : { text: many ? " también han respondido en " : " también ha respondido en " },
        title,
      ];
      href = `/community/${String(m.threadId ?? "")}${m.replyId ? `#reply-${String(m.replyId)}` : ""}`;
      break;
    }
    // Quien lo llevaba ha borrado su cuenta y el grupo o el evento pasa a
    // quien más tiempo llevaba en él. No hay actor: esa cuenta ya no existe.
    case "group_inherited":
      emoji = "👑";
      parts = [{ text: "Ahora llevas tú " }, groupName, { text: ": la persona que lo gestionaba ha borrado su cuenta" }];
      href = `${groupHref}?tab=members`;
      break;
    case "event_inherited":
      emoji = "👑";
      parts = [{ text: "Ahora gestionas tú " }, eventName, { text: ": la persona que lo organizaba ha borrado su cuenta" }];
      href = eventHref;
      break;
    case "report_created": {
      emoji = "🚩";
      const count = typeof m.count === "number" ? m.count : 1;
      parts =
        count > 1
          ? [{ text: "Tienes " }, { text: `${count} denuncias nuevas`, strong: true }, { text: " por revisar" }]
          : [actor, { text: ` ha denunciado ${String(m.targetLabel ?? "un contenido")}` }, { text: ". Revísalo" }];
      href = "/admin/reports";
      break;
    }
    default:
      parts = [{ text: "Tienes una novedad" }];
  }

  return {
    id: n.id,
    type: n.type,
    emoji,
    parts,
    href,
    thumbnail: (typeof m.thumbnail === "string" ? m.thumbnail : null) ?? firstThumb ?? null,
    actor: n.actor ? { name: actorName!, avatarUrl: n.actor.avatarUrl } : null,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  };
}

// ── Destinatarios habituales ────────────────────────────────────────────────

/** Quien gestiona el grupo: propietario y admins. */
export async function groupManagerIds(groupId: string): Promise<string[]> {
  const rows = await prisma.groupMember.findMany({
    where: { groupId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Quien gestiona el evento: quien lo creó y sus admins. */
export async function eventManagerIds(eventId: string): Promise<string[]> {
  const [event, admins] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { createdById: true } }),
    prisma.eventAttendee.findMany({
      where: { eventId, role: "admin" },
      select: { userId: true },
    }),
  ]);
  return [...(event ? [event.createdById] : []), ...admins.map((a) => a.userId)];
}

/** Variante fire-and-forget: busca a quién avisar y avisa, sin esperar. */
export function notifyManagers(
  scope: { groupId: string } | { eventId: string },
  input: Omit<NotifyInput, "userIds" | "groupId" | "eventId">
) {
  inBackground(async () => {
    const userIds = await ("groupId" in scope
      ? groupManagerIds(scope.groupId)
      : eventManagerIds(scope.eventId));
    await notifyNow({ ...input, ...scope, userIds });
  });
}
