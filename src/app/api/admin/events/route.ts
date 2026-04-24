import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

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
        name: e.createdBy.displayName || e.createdBy.name || e.createdBy.email,
        email: e.createdBy.email,
      },
    }))
  );
}
