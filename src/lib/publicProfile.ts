import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Perfil público de un jugador. Se ve SIN cuenta, así que lo que sale de aquí
// es lo que cualquiera puede leer en internet. Deliberadamente NO sale:
//   - el email (ni el suyo ni el pendiente de confirmar)
//   - el apellido ni nada del formulario privado del perfil
//   - la puntuación de permanencia ni las notas de su colección
//   - eventos privados a los que quien mira no tiene acceso
//   - actividad de grupos a los que quien mira no pertenece
//
// Quien mira sin cuenta no tiene grupos ni eventos, así que ve el subconjunto
// verdaderamente público: ficha, vitrina, eventos públicos y la actividad de
// esos eventos. Nada de grupos.
const ACTIVITY_LIMIT = 20;
const PAST_EVENTS_LIMIT = 6;

const PROFILE_SELECT = {
  id: true,
  name: true,
  displayName: true,
  location: true,
  bggUsername: true,
  avatarUrl: true,
  createdAt: true,
  slug: true,
} as const;

export interface ProfileEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  imageUrl: string | null;
  visibility: string;
  isOrganizer: boolean;
  status: string;
  attendeeCount: number;
  gameCount: number;
}

export interface ProfileActivityItem {
  id: string;
  type: string;
  scope: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    slug: string | null;
  };
  group?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
}

export interface PublicProfile {
  id: string;
  slug: string;
  displayName: string;
  location: string | null;
  bggUsername: string | null;
  avatarUrl: string | null;
  memberSince: string;
  isSelf: boolean;
  sharedGroups: { id: string; name: string; type: string }[];
  showcase: {
    bggId: number;
    name: string;
    image: string | null;
    thumbnail: string | null;
  }[];
  upcomingEvents: ProfileEvent[];
  pastEvents: ProfileEvent[];
  activity: ProfileActivityItem[];
}

/**
 * Busca al dueño del perfil. Cacheado por petición: la cabecera (metadatos,
 * redirección canónica) y el perfil entero lo piden por separado y no tiene
 * sentido ir dos veces a la BD.
 * La URL admite el slug (/users/emper) o el id,
 * que sigue siendo el enlace permanente de quien no tiene slug — y de quien
 * lo tiene, por si compartió el enlace antiguo.
 */
const findProfileUser = cache(async (param: string) => {
  const bySlug = await prisma.user.findUnique({
    where: { slug: param.toLowerCase().trim() },
    select: PROFILE_SELECT,
  });
  if (bySlug) return bySlug;

  return prisma.user.findUnique({
    where: { id: param },
    select: PROFILE_SELECT,
  });
});

export interface ProfileHeader {
  slug: string;
  displayName: string;
  location: string | null;
  bggUsername: string | null;
  avatarUrl: string | null;
  /** Juegos en la vitrina, contados igual que los que se pintan. */
  showcaseCount: number;
  /** Eventos públicos a los que va y aún no han pasado. */
  upcomingEventCount: number;
  stats: ProfileStats;
}

/**
 * Los números del perfil: las insignias de la página y la fila de cifras de
 * la tarjeta. Son totales, nunca listas: que alguien esté en 4 grupos o haya
 * ido a 12 eventos se puede contar sin decir cuáles, así que aquí sí entran
 * los grupos y los eventos privados que el resto del perfil se calla.
 */
export interface ProfileStats {
  /** Juegos base que tiene (sin expansiones ni wishlist). */
  games: number;
  expansions: number;
  /** Partidas que lleva apuntadas en BGG a sus juegos. */
  plays: number;
  groups: number;
  /** Eventos a los que se ha apuntado en firme, pasados y futuros. */
  events: number;
  /** Eventos que ha montado él. */
  hosted: number;
  votes: number;
  reviews: number;
}

/**
 * Ficha mínima para el `<title>`, la descripción y la tarjeta de compartir.
 * Solo lleva datos públicos: la ve cualquiera que reciba el enlace.
 */
export const getProfileHeader = cache(
  async (param: string): Promise<ProfileHeader | null> => {
    const user = await findProfileUser(decodeURIComponent(param));
    if (!user) return null;

    // La vitrina se cuenta cruzando las marcas con la colección, igual que al
    // pintarla: si no, un juego que ya no tiene en BGG inflaría el número.
    const entries = await prisma.collectionEntry.findMany({
      where: { userId: user.id, showcased: true },
      select: { bggId: true },
    });
    const bggUsername = user.bggUsername?.toLowerCase().trim() || null;
    const [
      showcaseCount,
      upcomingEventCount,
      owned,
      groups,
      events,
      hosted,
      votes,
      reviews,
    ] = await Promise.all([
      entries.length && bggUsername
        ? prisma.collectionGame.count({
            where: {
              bggUsername,
              bggId: { in: entries.map((e) => e.bggId) },
            },
          })
        : 0,
      prisma.eventAttendee.count({
        where: {
          userId: user.id,
          status: { in: ["attending", "maybe"] },
          event: { visibility: "public", date: { gte: new Date() } },
        },
      }),
      // De una pasada: cuántos juegos y expansiones tiene y cuántas partidas
      // les ha apuntado. Sin BGG conectado no hay colección que contar.
      bggUsername
        ? prisma.collectionGame.groupBy({
            by: ["subtype"],
            where: { bggUsername, status: "own" },
            _count: { _all: true },
            _sum: { numPlays: true },
          })
        : [],
      prisma.groupMember.count({ where: { userId: user.id } }),
      prisma.eventAttendee.count({
        where: { userId: user.id, status: "attending" },
      }),
      prisma.event.count({ where: { createdById: user.id } }),
      prisma.vote.count({ where: { userId: user.id } }),
      prisma.gameReview.count({ where: { userId: user.id } }),
    ]);

    const bases = owned.find((o) => o.subtype === "boardgame");
    const exps = owned.find((o) => o.subtype === "boardgameexpansion");

    return {
      slug: user.slug || user.id,
      displayName: user.displayName || user.name || "Jugador",
      location: user.location,
      bggUsername: user.bggUsername,
      avatarUrl: user.avatarUrl,
      showcaseCount,
      upcomingEventCount,
      stats: {
        games: bases?._count._all ?? 0,
        expansions: exps?._count._all ?? 0,
        plays: owned.reduce((sum, o) => sum + (o._sum.numPlays ?? 0), 0),
        groups,
        events,
        hosted,
        votes,
        reviews,
      },
    };
  }
);

/**
 * La frase con la que se presenta el perfil fuera de la app: la descripción
 * del enlace y, si no hay cifras que pintar, la tarjeta al compartirlo.
 */
export function profileTagline(header: ProfileHeader): string {
  const quien = header.location
    ? `${header.displayName}, de ${header.location}`
    : header.displayName;
  const { games, groups } = header.stats;
  const n = (count: number, one: string, many: string) =>
    `${count.toLocaleString("es-ES")} ${count === 1 ? one : many}`;

  const tiene: string[] = [];
  if (games > 0) tiene.push(`${n(games, "juego", "juegos")} en su colección`);
  if (header.showcaseCount > 0) {
    // Con la colección delante, "juegos" ya se sobreentiende.
    tiene.push(
      games > 0
        ? `${header.showcaseCount} en su vitrina`
        : `${n(header.showcaseCount, "juego", "juegos")} en su vitrina`
    );
  }
  if (groups > 0) tiene.push(n(groups, "grupo de juego", "grupos de juego"));
  if (header.upcomingEventCount > 0) {
    tiene.push(`${n(header.upcomingEventCount, "evento", "eventos")} a la vista`);
  }

  if (tiene.length === 0) {
    return `${quien}. Su vitrina, sus eventos y lo último que ha jugado, en BG Planner.`;
  }
  const lista =
    tiene.length === 1
      ? tiene[0]
      : `${tiene.slice(0, -1).join(", ")} y ${tiene[tiene.length - 1]}`;
  return `${quien}. ${lista}, en BG Planner.`;
}

/**
 * Las cifras grandes de la tarjeta al compartir el perfil, las mismas que
 * sus insignias. Solo las que tiene: un cero en grande no presume de nada.
 */
export function profileCardStats(
  header: ProfileHeader
): { value: string; label: string }[] {
  const { games, groups, events } = header.stats;
  const stats = [
    { n: games, one: "juego", many: "juegos" },
    { n: header.showcaseCount, one: "en la vitrina", many: "en la vitrina" },
    { n: groups, one: "grupo", many: "grupos" },
    { n: events, one: "evento", many: "eventos" },
  ];
  return stats
    .filter((s) => s.n > 0)
    .map((s) => ({
      value: s.n.toLocaleString("es-ES"),
      label: s.n === 1 ? s.one : s.many,
    }));
}

/**
 * Todo el perfil, recortado a lo que puede ver quien mira.
 *
 * @param viewerId usuario que mira, o null si entra sin cuenta.
 */
export async function getPublicProfile(
  param: string,
  viewerId: string | null
): Promise<PublicProfile | null> {
  const user = await findProfileUser(decodeURIComponent(param));
  if (!user) return null;

  // Con qué puede cruzarse quien mira: sus grupos y sus eventos. Sirve para
  // decidir qué eventos y qué actividad del otro puede ver. Sin cuenta no hay
  // nada de esto, y las listas vacías ya recortan solas las consultas.
  const [viewerMemberships, viewerAttendances] = viewerId
    ? await Promise.all([
        prisma.groupMember.findMany({
          where: { userId: viewerId },
          select: { groupId: true },
        }),
        prisma.eventAttendee.findMany({
          where: { userId: viewerId },
          select: { eventId: true },
        }),
      ])
    : [[], []];
  const viewerGroupIds = viewerMemberships.map((m) => m.groupId);
  const viewerEventIds = viewerAttendances.map((a) => a.eventId);

  // Grupos en común. De los grupos del otro solo enseñamos estos: los demás
  // no son asunto de quien mira, y quien no tiene cuenta no ve ninguno.
  const sharedGroups = viewerGroupIds.length
    ? await prisma.groupMember.findMany({
        where: { userId: user.id, groupId: { in: viewerGroupIds } },
        select: { group: { select: { id: true, name: true, type: true } } },
        orderBy: { joinedAt: "asc" },
      })
    : [];

  // ── Vitrina ────────────────────────────────────────────────────────────
  // Los juegos que ha marcado como imprescindibles en su colección. Van por
  // userId (la marca) cruzado con su usuario de BGG (los datos del juego).
  let showcase: PublicProfile["showcase"] = [];

  if (user.bggUsername) {
    const entries = await prisma.collectionEntry.findMany({
      where: { userId: user.id, showcased: true },
      select: { bggId: true },
    });
    if (entries.length > 0) {
      const rows = await prisma.collectionGame.findMany({
        where: {
          bggUsername: user.bggUsername.toLowerCase().trim(),
          bggId: { in: entries.map((e) => e.bggId) },
        },
        select: { bggId: true, name: true, image: true, thumbnail: true },
      });
      showcase = rows.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  // ── Eventos ────────────────────────────────────────────────────────────
  // A los que asiste (o dice que quizás). Los privados solo si quien mira
  // también está dentro: suyo o de los que él mismo asiste.
  const attendances = await prisma.eventAttendee.findMany({
    where: {
      userId: user.id,
      status: { in: ["attending", "maybe"] },
      event: {
        OR: [
          { visibility: "public" },
          ...(viewerId
            ? [
                { createdById: viewerId },
                { id: { in: viewerEventIds } },
              ]
            : []),
        ],
      },
    },
    select: {
      status: true,
      event: {
        select: {
          id: true,
          name: true,
          date: true,
          endDate: true,
          location: true,
          imageUrl: true,
          visibility: true,
          createdById: true,
          _count: { select: { attendees: true, games: true } },
        },
      },
    },
    orderBy: { event: { date: "asc" } },
  });

  const now = new Date();
  const eventItems: ProfileEvent[] = attendances.map((a) => ({
    id: a.event.id,
    name: a.event.name,
    date: a.event.date.toISOString(),
    endDate: a.event.endDate ? a.event.endDate.toISOString() : null,
    location: a.event.location,
    imageUrl: a.event.imageUrl,
    visibility: a.event.visibility,
    isOrganizer: a.event.createdById === user.id,
    status: a.status,
    attendeeCount: a.event._count.attendees,
    gameCount: a.event._count.games,
  }));

  const eventEnd = (e: ProfileEvent) => new Date(e.endDate ?? e.date);
  const upcomingEvents = eventItems.filter((e) => eventEnd(e) >= now);
  const pastEvents = eventItems
    .filter((e) => eventEnd(e) < now)
    .reverse()
    .slice(0, PAST_EVENTS_LIMIT);

  // ── Actividad reciente ─────────────────────────────────────────────────
  // Solo la pública, y solo la que quien mira podría haber visto ya en su
  // propio feed: grupos suyos o eventos públicos / a los que asiste. Sin
  // cuenta, únicamente la de eventos públicos.
  const activity = await prisma.activityLog.findMany({
    where: {
      userId: user.id,
      scope: "public",
      OR: [
        ...(viewerGroupIds.length ? [{ groupId: { in: viewerGroupIds } }] : []),
        { event: { visibility: "public" } },
        ...(viewerEventIds.length ? [{ eventId: { in: viewerEventIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: ACTIVITY_LIMIT,
    select: {
      id: true,
      type: true,
      scope: true,
      userId: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          slug: true,
        },
      },
      group: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
    },
  });

  return {
    id: user.id,
    slug: user.slug || user.id,
    displayName: user.displayName || user.name || "Jugador",
    location: user.location,
    bggUsername: user.bggUsername,
    avatarUrl: user.avatarUrl,
    memberSince: user.createdAt.toISOString(),
    isSelf: user.id === viewerId,
    sharedGroups: sharedGroups.map((m) => m.group),
    showcase,
    upcomingEvents,
    pastEvents,
    activity: activity.map((a) => ({
      ...a,
      metadata: a.metadata as Record<string, unknown>,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
