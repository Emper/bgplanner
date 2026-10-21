import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireSession } from "@/lib/api";
import { searchBggGames } from "@/lib/bgg";

// Buscador de juegos de BGG (con la base de datos local de respaldo).
export const GET = apiHandler(async (request: NextRequest) => {
  await requireSession(request);

  const query = request.nextUrl.searchParams.get("q") || "";
  if (query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchBggGames(query);

  // Al borrar y volver a escribir, la misma búsqueda sale del navegador
  return NextResponse.json(results, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
});
