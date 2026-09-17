import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";
import { FEEDBACK_STATUSES } from "@/lib/features";

const STATUS_IDS = FEEDBACK_STATUSES.map((s) => s.id) as string[];

// La bandeja siempre tiene que ver el estado real, sin cachés por medio.
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// Bandeja de feedback del panel de admin. Devuelve todo (con contadores por
// estado) para que la UI pueda filtrar sin repetir llamadas.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  const status = statusParam && STATUS_IDS.includes(statusParam) ? statusParam : null;

  const [items, grouped] = await Promise.all([
    prisma.feedback.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, displayName: true, email: true, avatarUrl: true } },
        reviewedBy: { select: { name: true, displayName: true, email: true } },
        feature: {
          select: { id: true, title: true, status: true, _count: { select: { votes: true } } },
        },
      },
    }),
    prisma.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: Record<string, number> = {};
  for (const id of STATUS_IDS) counts[id] = 0;
  for (const g of grouped) counts[g.status] = g._count._all;

  return NextResponse.json(
    {
      counts,
      items: items.map((f) => ({
        id: f.id,
        subject: f.subject,
        message: f.message,
        images: f.images,
        status: f.status,
        adminNote: f.adminNote,
        createdAt: f.createdAt,
        reviewedAt: f.reviewedAt,
        reviewedBy: f.reviewedBy
          ? f.reviewedBy.displayName || f.reviewedBy.name || f.reviewedBy.email
          : null,
        author: {
          id: f.user.id,
          name: f.user.displayName || f.user.name || f.user.email,
          email: f.user.email,
          avatarUrl: f.user.avatarUrl,
        },
        feature: f.feature
          ? {
              id: f.feature.id,
              title: f.feature.title,
              status: f.feature.status,
              votes: f.feature._count.votes,
            }
          : null,
      })),
    },
    NO_STORE
  );
}
