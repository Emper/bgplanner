import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getRecommendations } from "@/lib/recommendations";

// Juegos que te pueden gustar y que no conoces, a partir de tu colección y
// tus valoraciones. No habla con BGG: recomienda con lo que ya tenemos y
// devuelve en `status` lo que falta por preparar, para que la página lo vaya
// pidiendo a /api/recommendations/prepare.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { bggUsername: true },
  });
  if (!user?.bggUsername) {
    return NextResponse.json({ connected: false, forYou: [], becauseYouLiked: [] });
  }

  const result = await getRecommendations(session.userId, user.bggUsername);
  return NextResponse.json(result);
}
