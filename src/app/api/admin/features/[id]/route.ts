import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";
import { featureUpdateSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = featureUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const exists = await prisma.feature.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  }

  const feature = await prisma.feature.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      _count: { select: { votes: true, feedbacks: true } },
    },
  });

  return NextResponse.json({
    id: feature.id,
    title: feature.title,
    description: feature.description,
    status: feature.status,
    createdAt: feature.createdAt,
    votes: feature._count.votes,
    feedbacks: feature._count.feedbacks,
  });
}

// Borra la propuesta, sus votos y el feedback original que la generó: es lo que
// se espera al quitar una entrada de la lista, ya implementada o descartada.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { id } = await params;
  await prisma.$transaction([
    prisma.feedback.deleteMany({ where: { featureId: id } }),
    prisma.feature.deleteMany({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
}
