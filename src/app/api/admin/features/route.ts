import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";
import { featureCreateSchema } from "@/lib/validations";

// Todas las propuestas del roadmap, incluidas las descartadas (que no salen
// en la vista pública), con sus votos y los feedbacks que las originaron.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const features = await prisma.feature.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { votes: true, feedbacks: true } },
      votes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          createdAt: true,
          user: { select: { id: true, name: true, displayName: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  return NextResponse.json(
    features
      .map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        createdAt: f.createdAt,
        votes: f._count.votes,
        feedbacks: f._count.feedbacks,
        voters: f.votes.map((v) => ({
          id: v.user.id,
          name: v.user.displayName || v.user.name || v.user.email,
          avatarUrl: v.user.avatarUrl,
        })),
      }))
  );
}

// Crea una propuesta a mano (sin venir de un feedback).
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = featureCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const feature = await prisma.feature.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status || "proposed",
      createdById: session.userId,
    },
    select: { id: true, title: true, description: true, status: true, createdAt: true },
  });

  return NextResponse.json({ ...feature, votes: 0, feedbacks: 0, voters: [] }, { status: 201 });
}
