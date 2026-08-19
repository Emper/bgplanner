import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { blockSchema } from "@/lib/validations";

// Personas bloqueadas por quien pregunta.
//
// Ni bloquear ni desbloquear se escriben en el activity log: es una decisión
// privada y el feed lo vería el propio grupo, incluida la persona bloqueada.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const blocks = await prisma.block.findMany({
    where: { blockerId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      blocked: {
        select: { id: true, name: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const response = NextResponse.json({
    blocks: blocks.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      user: {
        id: b.blocked.id,
        name: b.blocked.displayName || b.blocked.name || "Alguien",
        avatarUrl: b.blocked.avatarUrl,
      },
    })),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { userId } = parsed.data;

  if (userId === session.userId) {
    return NextResponse.json(
      { error: "No puedes bloquearte a ti mismo" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, displayName: true, avatarUrl: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Esa persona no existe" },
      { status: 404 }
    );
  }

  // Idempotente: volver a bloquear a quien ya está bloqueado no es un error.
  await prisma.block.upsert({
    where: {
      blockerId_blockedId: { blockerId: session.userId, blockedId: userId },
    },
    create: { blockerId: session.userId, blockedId: userId },
    update: {},
  });

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: target.id,
        name: target.displayName || target.name || "Alguien",
        avatarUrl: target.avatarUrl,
      },
    },
    { status: 201 }
  );
}
