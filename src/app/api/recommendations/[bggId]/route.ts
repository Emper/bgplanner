import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { gameFlagSchema } from "@/lib/validations";

// Guardar un juego en tu wishlist de BG Planner, descartarlo ("no me
// interesa") o deshacer cualquiera de las dos cosas.
//
// La wishlist de BGG no se puede tocar desde fuera (su API es de solo
// lectura), así que esta vive aquí y se enseña junto a la de BGG en "Mi
// colección". Como el resto de la colección, no va al feed de actividad.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bggId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { bggId: rawBggId } = await params;
  const bggId = parseInt(rawBggId, 10);
  if (!Number.isInteger(bggId) || bggId <= 0) {
    return NextResponse.json({ error: "Juego no válido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = gameFlagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const { flag } = parsed.data;

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
    return NextResponse.json({ error: "No conocemos ese juego" }, { status: 404 });
  }

  await prisma.userGameFlag.upsert({
    where: { userId_bggId: { userId: session.userId, bggId } },
    update: { kind: flag, createdAt: new Date() },
    create: { userId: session.userId, bggId, kind: flag },
  });

  return NextResponse.json({ bggId, flag });
}
