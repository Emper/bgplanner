import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { removeReportTarget } from "@/lib/moderation";
import { REPORT_TARGET_LABELS, REPORT_TARGET_TYPES, type ReportTargetType } from "@/lib/reports";
import { reportActionSchema } from "@/lib/validations";

// Resuelve una denuncia y, con ella, todas las pendientes de lo mismo:
// - remove: retira lo denunciado (como si lo borrara su autor o un admin)
// - resolve: la da por atendida sin tocar nada (las de usuarios)
// - dismiss: no había nada que retirar
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

  const body = await request.json().catch(() => null);
  const parsed = reportActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action } = parsed.data;

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    select: { targetType: true, targetId: true },
  });
  if (!report || !REPORT_TARGET_TYPES.includes(report.targetType as ReportTargetType)) {
    return NextResponse.json({ error: "Denuncia no encontrada" }, { status: 404 });
  }
  const type = report.targetType as ReportTargetType;

  if (action === "remove") {
    if (type === "user") {
      return NextResponse.json(
        { error: "Un usuario no se retira desde aquí: márcala como resuelta" },
        { status: 400 }
      );
    }
    await removeReportTarget(type, report.targetId);
  }

  const { count } = await prisma.report.updateMany({
    where: { targetType: type, targetId: report.targetId, status: "pending" },
    data: {
      status: action === "dismiss" ? "dismissed" : "resolved",
      resolvedById: session.userId,
      resolvedAt: new Date(),
    },
  });

  logActivity("report_resolved", session.userId, {
    targetType: type,
    targetId: report.targetId,
    targetLabel: REPORT_TARGET_LABELS[type].a,
    action,
    reports: count,
  });

  return NextResponse.json({ ok: true, closed: count });
}
