import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collectionEntrySchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { normalizeBggUsername } from "@/lib/bgg";

type Params = { params: Promise<{ bggId: string }> };

// Puntuación de permanencia, nota y vitrina de un juego de MI colección.
//
// A propósito no se registra en el feed de actividad: que un juego esté en
// "quiero venderlo" es información privada del dueño y el feed lo enseñaría
// a todo su grupo.
export const PUT = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);

  const { bggId: rawBggId } = await params;
  const bggId = Number(rawBggId);
  if (!Number.isInteger(bggId) || bggId <= 0) {
    throw new ApiError(400, "Juego no válido");
  }

  const data = await parseBody(request, collectionEntrySchema);

  // Solo se puntúan juegos que están en tu propia colección de BGG.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { bggUsername: true },
  });
  if (!user?.bggUsername) {
    throw new ApiError(400, "Conecta tu usuario de BGG para puntuar tu colección");
  }

  // O en la de BGG, o en la wishlist de BG Planner.
  const [inCollection, savedHere, existing] = await Promise.all([
    prisma.collectionGame.findUnique({
      where: {
        bggUsername_bggId: {
          bggUsername: normalizeBggUsername(user.bggUsername),
          bggId,
        },
      },
      select: { id: true },
    }),
    prisma.userGameFlag.findFirst({
      where: { userId: session.userId, bggId, kind: "wishlist" },
      select: { id: true },
    }),
    prisma.collectionEntry.findUnique({
      where: { userId_bggId: { userId: session.userId, bggId } },
    }),
  ]);
  if (!inCollection && !savedHere) {
    throw new ApiError(404, "Ese juego no está en tu colección");
  }

  const next = {
    keepScore: data.keepScore !== undefined ? data.keepScore : (existing?.keepScore ?? null),
    note: data.note !== undefined ? data.note || null : (existing?.note ?? null),
    showcased: data.showcased !== undefined ? data.showcased : (existing?.showcased ?? false),
  };

  // Sin puntuación, sin nota y fuera de la vitrina no hay nada que guardar.
  if (next.keepScore === null && !next.note && !next.showcased) {
    // deleteMany: con dos clics seguidos el segundo ya no encuentra nada
    if (existing) {
      await prisma.collectionEntry.deleteMany({ where: { id: existing.id } });
    }
    return NextResponse.json({ bggId, ...next });
  }

  const entry = await prisma.collectionEntry.upsert({
    where: { userId_bggId: { userId: session.userId, bggId } },
    update: next,
    create: { userId: session.userId, bggId, ...next },
    select: { bggId: true, keepScore: true, note: true, showcased: true },
  });

  return NextResponse.json(entry);
});
