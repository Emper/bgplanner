import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, requireSession } from "@/lib/api";
import { getPrepStatus, prepareStep } from "@/lib/recommendations";

// Un paso de preparación de las recomendaciones (una o dos llamadas a BGG,
// unos segundos). La página llama en bucle mientras queden cosas por hacer,
// igual que con las expansiones de "Mi colección", para no agotar el tiempo
// de la función.
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { bggUsername: true },
  });
  if (!user?.bggUsername) {
    throw new ApiError(400, "Conecta tu usuario de BGG para ver recomendaciones");
  }

  try {
    const step = await prepareStep(session.userId, user.bggUsername);
    const status = await getPrepStatus(session.userId, user.bggUsername);
    return NextResponse.json({ step, status });
  } catch (error) {
    console.error("[Recomendaciones] Error preparando:", error);
    throw new ApiError(502, "BGG no ha respondido");
  }
});
