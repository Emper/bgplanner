import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchBggGameDetails } from "@/lib/bgg";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const bggId = parseInt(id);

  if (isNaN(bggId)) {
    return NextResponse.json({ error: "ID no válido" }, { status: 400 });
  }

  try {
    const [game] = await fetchBggGameDetails([bggId]);
    if (!game) {
      return NextResponse.json(
        { error: "Juego no encontrado" },
        { status: 404 }
      );
    }
    // La ficha de un juego apenas cambia: que el navegador no vuelva a
    // preguntar en un rato (privada: la ruta pide sesión)
    return NextResponse.json(game, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al obtener juego";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
