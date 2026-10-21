import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireSuperadmin } from "@/lib/api";
import { featureUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  await requireSuperadmin(request);
  const { id } = await params;
  const data = await parseBody(request, featureUpdateSchema);

  const exists = await prisma.feature.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new ApiError(404, "Propuesta no encontrada");

  const feature = await prisma.feature.update({
    where: { id },
    data,
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
});

// Borra la propuesta, sus votos y el feedback original que la generó: es lo que
// se espera al quitar una entrada de la lista, ya implementada o descartada.
export const DELETE = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  await requireSuperadmin(request);
  const { id } = await params;

  await prisma.$transaction([
    prisma.feedback.deleteMany({ where: { featureId: id } }),
    prisma.feature.deleteMany({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
});
