import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireSuperadmin } from "@/lib/api";
import { displayName } from "@/lib/users";

export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireSuperadmin(request);

  const { id } = await params;

  const [event, activity] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, displayName: true, email: true, avatarUrl: true },
        },
        attendees: {
          orderBy: { joinedAt: "asc" },
          include: {
            user: {
              select: { id: true, name: true, displayName: true, email: true, avatarUrl: true },
            },
          },
        },
        games: {
          include: {
            game: { select: { id: true, name: true, thumbnail: true } },
            addedBy: { select: { name: true, displayName: true, email: true } },
            interests: {
              include: {
                attendee: { include: { user: { select: { name: true, displayName: true, email: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, displayName: true, email: true } } },
    }),
  ]);

  if (!event) throw new ApiError(404, "Evento no encontrado");

  return NextResponse.json({
    id: event.id,
    name: event.name,
    description: event.description,
    date: event.date,
    endDate: event.endDate,
    location: event.location,
    maxAttendees: event.maxAttendees,
    visibility: event.visibility,
    imageUrl: event.imageUrl,
    createdAt: event.createdAt,
    createdBy: event.createdBy,
    attendees: event.attendees.map((a) => ({
      id: a.id,
      status: a.status,
      joinedAt: a.joinedAt,
      user: {
        id: a.user.id,
        name: displayName(a.user, a.user.email),
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
      },
    })),
    games: event.games.map((g) => ({
      id: g.id,
      gameName: g.game.name,
      thumbnail: g.game.thumbnail,
      addedAt: g.addedAt,
      addedBy: displayName(g.addedBy, g.addedBy.email),
      interests: g.interests.map((i) => ({
        intensity: i.intensity,
        userName: displayName(i.attendee.user, i.attendee.user.email),
      })),
    })),
    activity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      createdAt: a.createdAt,
      userName: displayName(a.user, a.user.email),
      metadata: a.metadata,
    })),
  });
});
