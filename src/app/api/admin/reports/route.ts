import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";
import { reportReviewSchema } from "@/lib/validations";
import {
  resolveReportTarget,
  type ReportTargetType,
} from "@/lib/moderation";

// Listado de denuncias para el panel de superadmin. Pendientes primero.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const status = new URL(request.url).searchParams.get("status");
  const reports = await prisma.report.findMany({
    where: status && status !== "all" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      reporter: { select: { id: true, name: true, displayName: true, email: true } },
    },
  });

  // El contenido denunciado vive en otras tablas y puede haber desaparecido;
  // por eso se resuelve aquí y no con un join.
  const enriched = await Promise.all(
    reports.map(async (r) => {
      const target = await resolveReportTarget(
        r.targetType as ReportTargetType,
        r.targetId
      ).catch(() => null);
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        reporter: {
          id: r.reporter.id,
          name: r.reporter.displayName || r.reporter.name || r.reporter.email,
          email: r.reporter.email,
        },
        target: target
          ? {
              ownerId: target.ownerId,
              ownerName: target.ownerName,
              kindLabel: target.kindLabel,
              snippet: target.snippet,
              groupId: target.groupId ?? null,
              eventId: target.eventId ?? null,
            }
          : null,
      };
    })
  );

  const response = NextResponse.json({ reports: enriched });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Marca una denuncia como resuelta o descartada.
export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await isSuperadmin(session))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reportReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { id, status, reviewNote } = parsed.data;

  const existing = await prisma.report.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Denuncia no encontrada" }, { status: 404 });
  }

  const report = await prisma.report.update({
    where: { id },
    data: {
      status,
      reviewedAt: status === "pending" ? null : new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
    select: { id: true, status: true, reviewedAt: true, reviewNote: true },
  });

  return NextResponse.json({ ok: true, report });
}
