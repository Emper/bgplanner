import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isVeto } from "@/lib/intensity";

// La lista de un asistente para un evento, tal y como se ve desde su enlace
// compartido. Sin notas: esas son privadas aunque la lista no lo sea.
export const findSharedList = cache(async (token: string) => {
  const attendee = await prisma.eventAttendee.findUnique({
    where: { listShareToken: token },
    select: {
      userId: true,
      user: { select: { name: true, displayName: true } },
      event: {
        select: { id: true, name: true, date: true, location: true, visibility: true, bggGeeklistId: true },
      },
      interests: {
        select: {
          intensity: true,
          playedAt: true,
          eventGame: {
            select: {
              id: true,
              leftGeeklistAt: true,
              game: { select: { name: true, thumbnail: true, bggId: true } },
            },
          },
        },
      },
    },
  });
  if (!attendee) return null;

  // Lo que ha salido de la lista de BGG del evento ya no cuenta
  const listed = attendee.event.bggGeeklistId
    ? attendee.interests.filter((i) => !i.eventGame.leftGeeklistAt)
    : attendee.interests;
  const items = listed.map((i) => ({
    id: i.eventGame.id,
    intensity: i.intensity,
    playedAt: i.playedAt,
    game: i.eventGame.game,
  }));

  // Igual que en "Mi Lista": primero lo que más apetece, y lo ya jugado al
  // final en el orden en que se marcó. Lo vetado, aparte y lo último.
  const byName = (a: (typeof items)[number], b: (typeof items)[number]) => a.game.name.localeCompare(b.game.name, "es");
  const pending = items
    .filter((i) => !i.playedAt && !isVeto(i.intensity))
    .sort((a, b) => b.intensity - a.intensity || byName(a, b));
  const played = items
    .filter((i) => i.playedAt)
    .sort((a, b) => a.playedAt!.getTime() - b.playedAt!.getTime());
  const vetoed = items.filter((i) => !i.playedAt && isVeto(i.intensity)).sort(byName);

  return {
    ownerId: attendee.userId,
    ownerName: attendee.user.displayName || attendee.user.name || "Alguien",
    event: {
      id: attendee.event.id,
      name: attendee.event.name,
      date: attendee.event.date,
      location: attendee.event.location,
      visibility: attendee.event.visibility,
      isPublic: attendee.event.visibility === "public",
    },
    pending,
    played,
    vetoed,
  };
});

export type SharedList = NonNullable<Awaited<ReturnType<typeof findSharedList>>>;
