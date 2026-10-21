import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyNow } from "@/lib/notifications";
import { inBackground } from "@/lib/background";
import { describeReportTarget, moderatorIds } from "@/lib/moderation";
import { REPORT_TARGET_LABELS } from "@/lib/reports";
import { reportSchema } from "@/lib/validations";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";

const MAX_REPORTS_PER_HOUR = 10;

// Denunciar un hilo, una respuesta, una foto, una opinión o a un usuario. Se
// avisa a quien modera por la campana (y su push), que lleva a /admin/reports.
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { targetType, targetId, reason, text } = await parseBody(request, reportSchema);

  const recent = await prisma.report.count({
    where: { reporterId: session.userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_REPORTS_PER_HOUR) {
    throw new ApiError(429, "Has enviado muchas denuncias seguidas. Prueba de nuevo en un rato");
  }

  // Solo se denuncia lo que uno puede ver (y no lo propio).
  const target = await describeReportTarget(targetType, targetId, session.userId);
  if (!target) throw new ApiError(404, "No encontramos lo que quieres denunciar");
  if (target.authorId === session.userId) {
    throw new ApiError(
      400,
      targetType === "user" ? "No puedes denunciarte a ti mismo" : "No puedes denunciar algo tuyo"
    );
  }

  const report = await prisma.report
    .create({
      data: {
        reporterId: session.userId,
        targetType,
        targetId,
        targetUserId: target.authorId,
        reason,
        text: text || null,
      },
      select: { id: true },
    })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ApiError(409, "Ya lo habías denunciado. Lo estamos revisando");
      }
      throw err;
    });
  const reportId = report.id;

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
});
