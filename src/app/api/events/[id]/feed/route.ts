import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parsePage, requireSession } from "@/lib/api";
import { getEventFeed } from "@/lib/eventFeed";

// Actividad del evento, paginada por cursor. La de un evento privado es solo
// para quien puede verlo.
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: eventId } = await params;

    const page = parsePage(request.nextUrl.searchParams);

    return NextResponse.json(await getEventFeed(eventId, session.userId, page));
  }
);
