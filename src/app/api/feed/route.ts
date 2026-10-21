import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parsePage, requireSession } from "@/lib/api";
import { getMyFeed, MY_FEED_PAGE } from "@/lib/feedData";

// Lo que ha pasado en mis grupos y eventos, de lo más reciente hacia atrás.
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const page = parsePage(request.nextUrl.searchParams, MY_FEED_PAGE);
  return NextResponse.json(await getMyFeed(session.userId, page));
});
