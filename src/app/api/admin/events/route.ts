import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSuperadmin } from "@/lib/api";
import { displayName } from "@/lib/users";

export const GET = apiHandler(async (request: NextRequest) => {
  await requireSuperadmin(request);

  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true, email: true } },
      _count: { select: { attendees: true, games: true } },
    },
  });

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      name: e.name,
      visibility: e.visibility,
      date: e.date,
      endDate: e.endDate,
      location: e.location,
      maxAttendees: e.maxAttendees,
      attendees: e._count.attendees,
      games: e._count.games,
      createdAt: e.createdAt,
      createdBy: {
        id: e.createdBy.id,
        name: displayName(e.createdBy, e.createdBy.email),
        email: e.createdBy.email,
      },
    }))
  );
});
