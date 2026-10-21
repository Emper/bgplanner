import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiHandler, requireSession } from "@/lib/api";
import { fetchBggGameDetails } from "@/lib/bgg";

type Params = { params: Promise<{ id: string }> };

// La ficha de un juego tal y como la da BGG.
export const GET = apiHandler(async (request: NextRequest, { params }: Params) => {
  await requireSession(request);

  const { id } = await params;
  const bggId = Number(id);
  if (!Number.isInteger(bggId) || bggId <= 0) {
    throw new ApiError(400, "ID no válido");
  }

  let game;
  try {
    [game] = await fetchBggGameDetails([bggId]);
  } catch (error) {
    console.error("[BGG] Error al traer la ficha del juego:", error);
    throw new ApiError(502, "BGG no ha respondido. Prueba de nuevo en un rato");
  }
  if (!game) throw new ApiError(404, "Juego no encontrado");

  // La ficha de un juego apenas cambia: que el navegador no vuelva a
  // preguntar en un rato (privada: la ruta pide sesión)
  return NextResponse.json(game, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
});
