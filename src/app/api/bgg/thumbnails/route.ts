import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBggThumbnails } from "@/lib/bgg";

// Fase 2 de la búsqueda: dado un listado de IDs (los que la búsqueda devolvió
// sin imagen), resuelve sus thumbnails desde caché/BGG. Máximo 20 IDs.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const idsParam = request.nextUrl.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 20);

  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const thumbnails = await getBggThumbnails(ids);
  return NextResponse.json(thumbnails);
}
