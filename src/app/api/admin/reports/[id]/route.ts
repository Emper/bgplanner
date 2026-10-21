import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireSuperadmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { emailButton, emailNote, html, sendAppEmailLater } from "@/lib/email";
import { ExpelError, expelUser, removeReportTarget } from "@/lib/moderation";
import { absoluteUrl } from "@/lib/site";
import { REPORT_TARGET_LABELS, REPORT_TARGET_TYPES, reportReasonLabel, type ReportTargetType } from "@/lib/reports";
import { reportActionSchema } from "@/lib/validations";

// Resuelve una denuncia y, con ella, todas las pendientes de lo mismo:
// - remove: retira lo denunciado (como si lo borrara su autor o un admin)
// - resolve: la da por atendida sin tocar nada (las de usuarios)
// - dismiss: no había nada que retirar
// - expel: retira lo denunciado y expulsa a su autor (borra la cuenta y veta
//   su email). Con removeContent, también sus mensajes de la Comunidad y fotos.
export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await requireSuperadmin(request);
  const { action, removeContent = false } = await parseBody(request, reportActionSchema);

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    select: { targetType: true, targetId: true, targetUserId: true },
  });
  if (!report || !REPORT_TARGET_TYPES.includes(report.targetType as ReportTargetType)) {
    throw new ApiError(404, "Denuncia no encontrada");
  }
  const type = report.targetType as ReportTargetType;

  if (action === "remove") {
    if (type === "user") {
      throw new ApiError(400, "Un usuario no se retira desde aquí: márcala como resuelta");
    }
    await removeReportTarget(type, report.targetId);
  }

  if (action === "expel") {
    if (!report.targetUserId) {
      throw new ApiError(400, "No se sabe de quién es: ya no tiene cuenta");
    }
    const reasons = await prisma.report.findMany({
      where: { targetType: type, targetId: report.targetId },
      select: { reason: true },
      distinct: ["reason"],
    });
    const reason = `${reasons.map((r) => reportReasonLabel(r.reason)).join(", ")} · ${REPORT_TARGET_LABELS[type].noun}`;

    let expelled: { email: string; name: string | null };
    try {
      expelled = await expelUser(report.targetUserId, session.userId, { removeContent, reason });
    } catch (err) {
      if (err instanceof ExpelError) {
        throw new ApiError(err.status, err.message);
      }
      throw err;
    }
    // Lo denunciado se retira aunque no se pidiera retirar todo lo demás.
    if (type !== "user") await removeReportTarget(type, report.targetId);

    sendAppEmailLater({
      to: expelled.email,
      subject: "Hemos cerrado tu cuenta de BG Planner",
      body: html`<p>Hemos cerrado tu cuenta de BG Planner porque lo que publicaste incumple nuestros términos de uso, que no toleran el contenido ofensivo ni el acoso.</p>
<p>Tu cuenta y tus datos personales se han borrado, y este email ya no sirve para entrar.</p>
${emailNote("Si crees que es un error, responde a este email o escríbenos desde la página de contacto.")}
${emailButton(absoluteUrl("/terms"), "Ver los términos de uso")}`,
    });
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
});
