import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchBggGames } from "@/lib/bgg";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") || "";
  if (query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchBggGames(query);

  // Al borrar y volver a escribir, la misma búsqueda sale del navegador
  return NextResponse.json(results, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
