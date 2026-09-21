import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

// Enlace de solo lectura de tu colección. El token va en la URL y no se
// puede adivinar; quien lo abra tendrá que iniciar sesión igualmente. Hay
// un único enlace por usuario: regenerarlo tumba el anterior.

// GET — enlace actual (null si no está compartida)
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { collectionShareToken: true },
  });

  return NextResponse.json({ token: user?.collectionShareToken ?? null });
}

// POST — crear el enlace, o regenerarlo si ya existía
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = crypto.randomBytes(16).toString("base64url");

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { collectionShareToken: token },
    select: { collectionShareToken: true },
  });

  return NextResponse.json({ token: user.collectionShareToken });
}

// DELETE — dejar de compartir
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { collectionShareToken: null },
  });

  return NextResponse.json({ token: null });
}
