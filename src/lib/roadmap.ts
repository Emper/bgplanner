import { prisma } from "@/lib/prisma";
import { PUBLIC_FEATURE_STATUSES } from "@/lib/features";

const PUBLIC_STATUS_IDS = PUBLIC_FEATURE_STATUSES.map((s) => s.id);

export interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  votes: number;
  hasVoted: boolean;
}

// Roadmap público: propuestas visibles y cuántos votos tiene cada una. Lo
// usan la página (pintada en el servidor) y la API. Nunca devuelve datos del
// autor del feedback original.
export async function getRoadmapFeatures(userId: string | null): Promise<RoadmapFeature[]> {
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
    userId
      ? prisma.featureVote.findMany({
          where: { userId },
          select: { featureId: true },
        })
      : Promise.resolve([]),
  ]);

  const voted = new Set(myVotes.map((v) => v.featureId));

  return (
    features
      .map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
        votes: f._count.votes,
        hasVoted: voted.has(f.id),
      }))
      // Más votadas primero; a igualdad de votos, la más reciente arriba.
      .sort((a, b) => b.votes - a.votes || b.createdAt.localeCompare(a.createdAt))
  );
}
