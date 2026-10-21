import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireSession } from "@/lib/api";
import { getGroupDashboard } from "@/lib/groupDashboard";

// Los refrescos del cliente (tras votar, marcar jugado…). La primera carga
// la hace la página de servidor con la misma función.
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  const response = NextResponse.json(await getGroupDashboard(groupId, session.userId));

  // No CDN cache — response is personalized per user (userVote, currentUserId)
  response.headers.set("Cache-Control", "private, no-store");

  return response;
});
