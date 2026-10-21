import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parsePage, requireSession } from "@/lib/api";
import { getNotificationsPage } from "@/lib/notifications";

/** Mis notificaciones, de la más reciente a la más antigua. */
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const page = parsePage(request.nextUrl.searchParams, { defaultLimit: 20, max: 50 });
  return NextResponse.json(await getNotificationsPage(session.userId, page));
});
