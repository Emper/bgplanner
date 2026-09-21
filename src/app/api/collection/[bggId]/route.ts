import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { collectionEntrySchema } from "@/lib/validations";

// Puntuación de permanencia, nota y vitrina de un juego de MI colección.
//
// A propósito no se registra en el feed de actividad: que un juego esté en
// "quiero venderlo" es información privada del dueño y el feed lo enseñaría
// a todo su grupo.
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

  const body = await request.json();
  const parsed = collectionEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Solo se puntúan juegos que están en tu propia colección de BGG.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { bggUsername: true },
  });
  if (!user?.bggUsername) {
    return NextResponse.json(
      { error: "Conecta tu usuario de BGG para puntuar tu colección" },
      { status: 400 }
    );
  }

  const inCollection = await prisma.collectionGame.findUnique({
    where: {
      bggUsername_bggId: {
        bggUsername: user.bggUsername.toLowerCase().trim(),
        bggId,
      },
    },
    select: { id: true },
  });
  if (!inCollection) {
    return NextResponse.json(
      { error: "Ese juego no está en tu colección" },
      { status: 404 }
    );
  }

  const existing = await prisma.collectionEntry.findUnique({
    where: { userId_bggId: { userId: session.userId, bggId } },
  });

  const next = {
    keepScore:
      parsed.data.keepScore !== undefined
        ? parsed.data.keepScore
        : (existing?.keepScore ?? null),
    note:
      parsed.data.note !== undefined
        ? parsed.data.note || null
        : (existing?.note ?? null),
    showcased:
      parsed.data.showcased !== undefined
        ? parsed.data.showcased
        : (existing?.showcased ?? false),
  };

  // Sin puntuación, sin nota y fuera de la vitrina no hay nada que guardar.
  if (next.keepScore === null && !next.note && !next.showcased) {
    if (existing) {
      await prisma.collectionEntry.delete({ where: { id: existing.id } });
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
}
