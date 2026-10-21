import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameFlagSchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";

type Params = { params: Promise<{ bggId: string }> };

// Guardar un juego en tu wishlist de BG Planner, descartarlo ("no me
// interesa") o deshacer cualquiera de las dos cosas.
//
// La wishlist de BGG no se puede tocar desde fuera (su API es de solo
// lectura), así que esta vive aquí y se enseña junto a la de BGG en "Mi
// colección". Como el resto de la colección, no va al feed de actividad.
export const PUT = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);

  const { bggId: rawBggId } = await params;
  const bggId = Number(rawBggId);
  if (!Number.isInteger(bggId) || bggId <= 0) {
    throw new ApiError(400, "Juego no válido");
  }

  const { flag } = await parseBody(request, gameFlagSchema);

  if (flag === null) {
    await prisma.userGameFlag.deleteMany({ where: { userId: session.userId, bggId } });
    return NextResponse.json({ bggId, flag: null });
  }

  // Solo juegos de los que tenemos ficha: es lo que permite enseñarlos
  // luego en la colección con su portada y sus datos.
  const info = await prisma.bggGameInfo.findUnique({
    where: { bggId },
    select: { subtype: true },
  });
  if (!info || info.subtype === "missing") {
    throw new ApiError(404, "No conocemos ese juego");
  }

  await prisma.userGameFlag.upsert({
    where: { userId_bggId: { userId: session.userId, bggId } },
    update: { kind: flag, createdAt: new Date() },
    create: { userId: session.userId, bggId, kind: flag },
  });

  return NextResponse.json({ bggId, flag });
});
