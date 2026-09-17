import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PUBLIC_FEATURE_STATUSES } from "@/lib/features";

const PUBLIC_STATUS_IDS = PUBLIC_FEATURE_STATUSES.map((s) => s.id);

// Roadmap público: propuestas visibles y cuántos votos tiene cada una. Se
// puede leer sin sesión (para votar sí hace falta), así que nunca devuelve
// datos del autor del feedback original.
export async function GET(request: NextRequest) {
  const session = await getSession(request);

  const [features, myVotes] = await Promise.all([
    prisma.feature.findMany({
      where: { status: { in: PUBLIC_STATUS_IDS } },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        _count: { select: { votes: true } },
      },
    }),
    session
      ? prisma.featureVote.findMany({
          where: { userId: session.userId },
          select: { featureId: true },
        })
      : Promise.resolve([]),
  ]);

  const voted = new Set(myVotes.map((v) => v.featureId));

  return NextResponse.json({
    isLoggedIn: !!session,
    features: features
      .map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        createdAt: f.createdAt,
        votes: f._count.votes,
        hasVoted: voted.has(f.id),
      }))
      // Más votadas primero; a igualdad de votos, la más reciente arriba.
      .sort(
        (a, b) =>
          b.votes - a.votes ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
  });
}
