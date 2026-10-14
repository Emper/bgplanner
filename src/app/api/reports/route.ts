import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { inBackground, notifyNow } from "@/lib/notifications";
import { describeReportTarget, moderatorIds } from "@/lib/moderation";
import { REPORT_TARGET_LABELS } from "@/lib/reports";
import { reportSchema } from "@/lib/validations";

const MAX_REPORTS_PER_HOUR = 10;

// Denunciar un hilo, una respuesta, una foto, una opinión o a un usuario. Se
// avisa a quien modera por la campana (y su push), que lleva a /admin/reports.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { targetType, targetId, reason, text } = parsed.data;

  const recent = await prisma.report.count({
    where: { reporterId: session.userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_REPORTS_PER_HOUR) {
    return NextResponse.json(
      { error: "Has enviado muchas denuncias seguidas. Prueba de nuevo en un rato" },
      { status: 429 }
    );
  }

  // Solo se denuncia lo que uno puede ver (y no lo propio).
  const target = await describeReportTarget(targetType, targetId, session.userId);
  if (!target) {
    return NextResponse.json({ error: "No encontramos lo que quieres denunciar" }, { status: 404 });
  }
  if (target.authorId === session.userId) {
    return NextResponse.json(
      { error: targetType === "user" ? "No puedes denunciarte a ti mismo" : "No puedes denunciar algo tuyo" },
      { status: 400 }
    );
  }

  let reportId: string;
  try {
    const report = await prisma.report.create({
      data: {
        reporterId: session.userId,
        targetType,
        targetId,
        targetUserId: target.authorId,
        reason,
        text: text || null,
      },
      select: { id: true },
    });
    reportId = report.id;
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya lo habías denunciado. Lo estamos revisando" },
        { status: 409 }
      );
    }
    throw err;
  }

  const targetLabel = REPORT_TARGET_LABELS[targetType].a;
  logActivity("report_created", session.userId, { reportId, targetType, targetLabel, reason });

  inBackground(async () => {
    await notifyNow({
      type: "report_created",
      userIds: await moderatorIds(),
      actorId: session.userId,
      metadata: { reportId, targetType, targetLabel },
    });
  });

  return NextResponse.json({ ok: true });
}
