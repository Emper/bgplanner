import { cache } from "react";
import { prisma } from "@/lib/prisma";

// La lista de un asistente para un evento, tal y como se ve desde su enlace
// compartido. Sin notas: esas son privadas aunque la lista no lo sea.
export const findSharedList = cache(async (token: string) => {
  const attendee = await prisma.eventAttendee.findUnique({
    where: { listShareToken: token },
    select: {
      userId: true,
      user: { select: { name: true, displayName: true } },
      event: {
        select: { id: true, name: true, date: true, location: true, visibility: true },
      },
      interests: {
        select: {
          intensity: true,
          playedAt: true,
          eventGame: {
            select: {
              id: true,
              game: { select: { name: true, thumbnail: true, bggId: true } },
            },
          },
        },
      },
    },
  });
  if (!attendee) return null;

  const items = attendee.interests.map((i) => ({
    id: i.eventGame.id,
    intensity: i.intensity,
    playedAt: i.playedAt,
    game: i.eventGame.game,
  }));

  // Igual que en "Mi Lista": primero lo que más apetece, y lo ya jugado al
  // final en el orden en que se marcó.
  const pending = items
    .filter((i) => !i.playedAt)
    .sort((a, b) => b.intensity - a.intensity || a.game.name.localeCompare(b.game.name, "es"));
  const played = items
    .filter((i) => i.playedAt)
    .sort((a, b) => a.playedAt!.getTime() - b.playedAt!.getTime());

  return {
    ownerId: attendee.userId,
    ownerName: attendee.user.displayName || attendee.user.name || "Alguien",
    event: { ...attendee.event, isPublic: attendee.event.visibility === "public" },
    pending,
    played,
  };
});

export type SharedList = NonNullable<Awaited<ReturnType<typeof findSharedList>>>;
