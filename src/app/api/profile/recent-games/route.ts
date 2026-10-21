import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireSession } from "@/lib/api";
import { getRecentGames } from "@/lib/homeData";

// Juegos que ha añadido o votado, en todos sus grupos
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  return NextResponse.json(await getRecentGames(session.userId));
});
