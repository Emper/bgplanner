import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, parseBody, requireSuperadmin } from "@/lib/api";
import { displayName } from "@/lib/users";
import { featureCreateSchema } from "@/lib/validations";

// El panel siempre tiene que ver el estado real, sin cachés por medio.
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  email: true,
  avatarUrl: true,
} as const;

// Todas las propuestas del roadmap, incluidas las descartadas (que no salen
// en la vista pública), con sus votos y los feedbacks que las originaron.
export const GET = apiHandler(async (request: NextRequest) => {
  await requireSuperadmin(request);

  const features = await prisma.feature.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { votes: true } },
      votes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { user: { select: ADMIN_USER_SELECT } },
      },
      // El texto original de quien la propuso, con sus capturas: solo lo ve el
      // admin (en el roadmap público va la versión editada).
      feedbacks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          message: true,
          images: true,
          createdAt: true,
          user: { select: ADMIN_USER_SELECT },
        },
      },
    },
  });

  return NextResponse.json(
    features.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status,
      createdAt: f.createdAt,
      votes: f._count.votes,
      voters: f.votes.map((v) => ({
        id: v.user.id,
        name: displayName(v.user, v.user.email),
        avatarUrl: v.user.avatarUrl,
      })),
      origins: f.feedbacks.map((fb) => ({
        id: fb.id,
        message: fb.message,
        images: fb.images,
        createdAt: fb.createdAt,
        author: {
          id: fb.user.id,
          name: displayName(fb.user, fb.user.email),
          email: fb.user.email,
          avatarUrl: fb.user.avatarUrl,
        },
      })),
    })),
    NO_STORE
  );
});

// Crea una propuesta a mano (sin venir de un feedback).
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSuperadmin(request);
  const data = await parseBody(request, featureCreateSchema);

  const feature = await prisma.feature.create({
    data: {
      title: data.title,
      description: data.description,
      status: data.status || "proposed",
      createdById: session.userId,
    },
    select: { id: true, title: true, description: true, status: true, createdAt: true },
  });

  return NextResponse.json(
    { ...feature, votes: 0, voters: [], origins: [] },
    { status: 201, ...NO_STORE }
  );
});
