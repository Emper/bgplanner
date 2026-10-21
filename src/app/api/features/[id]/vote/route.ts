import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { ApiError, apiHandler, requireSession } from "@/lib/api";
import { isVotableStatus } from "@/lib/features";

type Params = { params: Promise<{ id: string }> };

function voteCount(featureId: string) {
  return prisma.featureVote.count({ where: { featureId } });
}

// Vota una propuesta del roadmap. Un voto por usuario y propuesta; se pueden
// votar tantas propuestas como se quiera.
export const POST = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id } = await params;

  const feature = await prisma.feature.findUnique({
    where: { id },
    select: { id: true, title: true, status: true },
  });
  if (!feature) throw new ApiError(404, "Propuesta no encontrada");
  if (!isVotableStatus(feature.status)) {
    throw new ApiError(409, "Esta propuesta ya no admite votos");
  }

  // Idempotente: votar dos veces no suma ni da error.
  await prisma.featureVote.upsert({
    where: { featureId_userId: { featureId: id, userId: session.userId } },
    create: { featureId: id, userId: session.userId },
    update: {},
  });

  logActivity("feature_voted", session.userId, { featureId: id, featureTitle: feature.title });

  return NextResponse.json({ votes: await voteCount(id), hasVoted: true });
});

// Quita el voto.
export const DELETE = apiHandler(async (request: NextRequest, { params }: Params) => {
  const session = await requireSession(request);
  const { id } = await params;
  await prisma.featureVote.deleteMany({ where: { featureId: id, userId: session.userId } });
  return NextResponse.json({ votes: await voteCount(id), hasVoted: false });
});
