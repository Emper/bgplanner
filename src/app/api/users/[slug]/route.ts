import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Perfil público de un jugador: lo que cualquier usuario logueado de BG
// Planner puede ver de otro. Deliberadamente NO sale de aquí:
//   - el email (ni el suyo ni el pendiente de confirmar)
//   - el apellido ni nada del formulario privado del perfil
//   - la puntuación de permanencia ni las notas de su colección
//   - eventos privados a los que quien mira no tiene acceso
//   - actividad de grupos a los que quien mira no pertenece
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
} as const;

// El slug de la URL es el usuario de BGG (/users/emper) y si no lo tiene, su
// id. El id manda porque es único y no cambia; el usuario de BGG ni es único
// en la BD ni es inmutable, así que ante un empate gana la cuenta más
// antigua para que el enlace siempre lleve al mismo sitio.
async function findProfileUser(slug: string) {
  const byId = await prisma.user.findUnique({
    where: { id: slug },
    select: PROFILE_SELECT,
  });
  if (byId) return byId;

  return prisma.user.findFirst({
    where: { bggUsername: slug.toLowerCase().trim() },
    orderBy: { createdAt: "asc" },
    select: PROFILE_SELECT,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { slug } = await params;
  const user = await findProfileUser(decodeURIComponent(slug));

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const isSelf = user.id === session.userId;

  // Con qué puede cruzarse quien mira: sus grupos y sus eventos. Sirve para
  // decidir qué eventos y qué actividad del otro puede ver.
  const [viewerMemberships, viewerAttendances] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: session.userId },
      select: { groupId: true },
    }),
    prisma.eventAttendee.findMany({
      where: { userId: session.userId },
      select: { eventId: true },
    }),
  ]);
  const viewerGroupIds = viewerMemberships.map((m) => m.groupId);
  const viewerEventIds = viewerAttendances.map((a) => a.eventId);

  // Grupos en común. De los grupos del otro solo enseñamos estos: los demás
  // no son asunto de quien mira.
  const sharedGroups = await prisma.groupMember.findMany({
    where: { userId: user.id, groupId: { in: viewerGroupIds } },
    select: { group: { select: { id: true, name: true, type: true } } },
    orderBy: { joinedAt: "asc" },
  });

  // ── Vitrina ────────────────────────────────────────────────────────────
  // Los juegos que ha marcado como imprescindibles en su colección. Van por
  // userId (la marca) cruzado con su usuario de BGG (los datos del juego).
  let showcase: {
    bggId: number;
    name: string;
    image: string | null;
    thumbnail: string | null;
  }[] = [];

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
  // también está dentro: público, suyo, o de los que él mismo asiste.
  const attendances = await prisma.eventAttendee.findMany({
    where: {
      userId: user.id,
      status: { in: ["attending", "maybe"] },
      event: {
        OR: [
          { visibility: "public" },
          { createdById: session.userId },
          { id: { in: viewerEventIds } },
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
  const eventItems = attendances.map((a) => ({
    id: a.event.id,
    name: a.event.name,
    date: a.event.date,
    endDate: a.event.endDate,
    location: a.event.location,
    imageUrl: a.event.imageUrl,
    visibility: a.event.visibility,
    isOrganizer: a.event.createdById === user.id,
    status: a.status,
    attendeeCount: a.event._count.attendees,
    gameCount: a.event._count.games,
  }));

  const eventEnd = (e: (typeof eventItems)[number]) =>
    new Date(e.endDate ?? e.date);
  const upcomingEvents = eventItems.filter((e) => eventEnd(e) >= now);
  const pastEvents = eventItems
    .filter((e) => eventEnd(e) < now)
    .reverse()
    .slice(0, PAST_EVENTS_LIMIT);

  // ── Actividad reciente ─────────────────────────────────────────────────
  // Solo la pública, y solo la que quien mira podría haber visto ya en su
  // propio feed: grupos suyos o eventos públicos / a los que asiste.
  const activity = await prisma.activityLog.findMany({
    where: {
      userId: user.id,
      scope: "public",
      OR: [
        { groupId: { in: viewerGroupIds } },
        { event: { visibility: "public" } },
        { eventId: { in: viewerEventIds } },
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
        select: { id: true, name: true, displayName: true, avatarUrl: true },
      },
      group: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    id: user.id,
    slug: user.bggUsername || user.id,
    displayName: user.displayName || user.name || "Jugador",
    location: user.location,
    bggUsername: user.bggUsername,
    avatarUrl: user.avatarUrl,
    memberSince: user.createdAt,
    isSelf,
    sharedGroups: sharedGroups.map((m) => m.group),
    showcase,
    upcomingEvents,
    pastEvents,
    activity,
  });
}
