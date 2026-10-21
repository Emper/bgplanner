import { NextRequest, NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateEventSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { getEventParticipation } from "@/lib/events";
import { ApiError, apiHandler, parseBody, requireSession, type Session } from "@/lib/api";
import { refreshGeeklistIfStale } from "@/lib/geeklist";

// Si el evento toma sus juegos de una lista de BGG, al abrirlo se reimporta
// después de responder: necesita margen por si BGG tarda en prepararla.
export const maxDuration = 300;

// Detalle del evento: juegos, asistentes e intereses
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        games: {
          // Orden de llegada, estable: es el orden «por defecto» de la pestaña
          orderBy: [{ addedAt: "asc" }, { id: "asc" }],
          include: {
            game: true,
            interests: {
              include: {
                attendee: {
                  include: { user: { select: { id: true, name: true, displayName: true, avatarUrl: true } } },
                },
              },
            },
          },
        },
        attendees: {
          // Campos a mano: el enlace de la lista compartida de cada uno no se
          // enseña al resto de asistentes
          select: {
            id: true,
            eventId: true,
            userId: true,
            status: true,
            role: true,
            joinedAt: true,
            user: { select: { id: true, name: true, displayName: true, surname: true, avatarUrl: true, bggUsername: true, slug: true } },
          },
          orderBy: { user: { name: "asc" } },
        },
      },
    });

    if (!event) throw new ApiError(404, "Evento no encontrado");

    // Un evento privado no existe para quien no está invitado
    const currentAttendee = event.attendees.find((a) => a.userId === session.userId);
    const isCreator = event.createdById === session.userId;
    if (event.visibility === "private" && !isCreator && !currentAttendee) {
      throw new ApiError(404, "Evento no encontrado");
    }

    // Las notas de los intereses son privadas: solo las ve su dueño
    const gamesWithFilteredInterests = event.games.map((eg) => ({
      ...eg,
      interests: eg.interests.map((interest) => ({
        id: interest.id,
        eventGameId: interest.eventGameId,
        attendeeId: interest.attendeeId,
        intensity: interest.intensity,
        notes: interest.attendeeId === currentAttendee?.id ? interest.notes : null,
        // Lo jugado sí se comparte: lo usa "Armar mesa" para bajar lo ya jugado
        playedAt: interest.playedAt,
        userName: interest.attendee.user.displayName || interest.attendee.user.name || "Alguien",
        userId: interest.attendee.user.id,
      })),
    }));

    const isAdmin = isCreator || currentAttendee?.role === "admin";

    refreshGeeklistIfStale(event);

    return NextResponse.json({
      ...event,
      // El enlace de invitación solo lo ve quien lo gestiona
      inviteCode: isAdmin ? event.inviteCode : null,
      games: gamesWithFilteredInterests,
      currentUserId: session.userId,
      isCreator,
      isAdmin,
      currentAttendeeId: currentAttendee?.id || null,
    });
  }
);

/**
 * ¿Puede gestionar el evento (o, con `creatorOnly`, borrarlo)? Quien lo
 * organiza o un superadmin. Un evento privado no existe (404) para quien no
 * lo ve, salvo para el superadmin.
 */
async function managerAccess(
  eventId: string,
  session: Session,
  { creatorOnly = false }: { creatorOnly?: boolean } = {}
) {
  const [admin, p] = await Promise.all([
    isSuperadmin(session),
    getEventParticipation(eventId, session.userId),
  ]);
  if (!p || (!admin && !p.canView)) throw new ApiError(404, "Evento no encontrado");
  const allowed = creatorOnly ? p.isCreator : p.isAdmin;
  return { superadmin: admin, allowed: admin || allowed, eventAdmin: p.isAdmin };
}

// Editar el evento (creador o admins)
export const PATCH = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id } = await params;

    const { allowed, superadmin, eventAdmin } = await managerAccess(id, session);
    if (!allowed) throw new ApiError(403, "Solo quien gestiona el evento puede editarlo");

    const body = await parseBody(request, updateEventSchema);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.about !== undefined) data.about = body.about?.trim() ? body.about : null;
    if (body.date) data.date = new Date(body.date);
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.location !== undefined) data.location = body.location;
    if (body.maxAttendees !== undefined) data.maxAttendees = body.maxAttendees;
    if (body.visibility !== undefined) data.visibility = body.visibility;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;

    const updated = await prisma.event.update({ where: { id }, data });

    logActivity("event_updated", session.userId, {
      eventId: id,
      eventName: updated.name,
      ...(superadmin && !eventAdmin ? { actorRole: "superadmin" } : {}),
    });

    return NextResponse.json(updated);
  }
);

// Borrar el evento (solo el creador, o un superadmin)
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id } = await params;

    const { allowed } = await managerAccess(id, session, { creatorOnly: true });
    if (!allowed) throw new ApiError(403, "Solo quien creó el evento puede eliminarlo");

    await prisma.event.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  }
);
