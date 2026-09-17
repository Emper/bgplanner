import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { isVotableStatus } from "@/lib/features";

async function getVotableFeature(id: string) {
  return prisma.feature.findUnique({
    where: { id },
    select: { id: true, title: true, status: true },
  });
}

// Vota una propuesta del roadmap. Un voto por usuario y propuesta; se pueden
// votar tantas propuestas como se quiera.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const feature = await getVotableFeature(id);
  if (!feature) {
    return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  }
  if (!isVotableStatus(feature.status)) {
    return NextResponse.json(
      { error: "Esta propuesta ya no admite votos" },
      { status: 409 }
    );
  }

  // Idempotente: votar dos veces no suma ni da error.
  await prisma.featureVote.upsert({
    where: { featureId_userId: { featureId: id, userId: session.userId } },
    create: { featureId: id, userId: session.userId },
    update: {},
  });

  logActivity("feature_voted", session.userId, { featureId: id, featureTitle: feature.title });

  const votes = await prisma.featureVote.count({ where: { featureId: id } });
  return NextResponse.json({ votes, hasVoted: true });
}

// Quita el voto.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.featureVote.deleteMany({ where: { featureId: id, userId: session.userId } });

  const votes = await prisma.featureVote.count({ where: { featureId: id } });
  return NextResponse.json({ votes, hasVoted: false });
}
