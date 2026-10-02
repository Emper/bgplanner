import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPrepStatus, prepareStep } from "@/lib/recommendations";

// Un paso de preparación de las recomendaciones (una o dos llamadas a BGG,
// unos segundos). La página llama en bucle mientras queden cosas por hacer,
// igual que con las expansiones de "Mi colección", para no agotar el tiempo
// de la función.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { bggUsername: true },
  });
  if (!user?.bggUsername) {
    return NextResponse.json({ error: "Sin usuario de BGG" }, { status: 400 });
  }

  try {
    const step = await prepareStep(session.userId, user.bggUsername);
    const status = await getPrepStatus(session.userId, user.bggUsername);
    return NextResponse.json({ step, status });
  } catch (error) {
    console.error("[Recomendaciones] Error preparando:", error);
    const message = error instanceof Error ? error.message : "BGG no ha respondido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
