import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parsePage, requireSession } from "@/lib/api";
import { getGroupFeed } from "@/lib/groupFeed";

export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: groupId } = await params;

    const page = parsePage(request.nextUrl.searchParams);
    return NextResponse.json(await getGroupFeed(groupId, session.userId, page));
  }
);
