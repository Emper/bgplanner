import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { ExpelError, expelUser, removeReportTarget } from "@/lib/moderation";
import { resend } from "@/lib/resend";
import { REPORT_TARGET_LABELS, REPORT_TARGET_TYPES, reportReasonLabel, type ReportTargetType } from "@/lib/reports";
import { reportActionSchema } from "@/lib/validations";

// Resuelve una denuncia y, con ella, todas las pendientes de lo mismo:
// - remove: retira lo denunciado (como si lo borrara su autor o un admin)
// - resolve: la da por atendida sin tocar nada (las de usuarios)
// - dismiss: no había nada que retirar
// - expel: retira lo denunciado y expulsa a su autor (borra la cuenta y veta
//   su email). Con removeContent, también sus mensajes de la Comunidad y fotos.
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
  const { action, removeContent = false } = parsed.data;

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    select: { targetType: true, targetId: true, targetUserId: true },
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

  if (action === "expel") {
    if (!report.targetUserId) {
      return NextResponse.json({ error: "No se sabe de quién es: ya no tiene cuenta" }, { status: 400 });
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
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
    // Lo denunciado se retira aunque no se pidiera retirar todo lo demás.
    if (type !== "user") await removeReportTarget(type, report.targetId);

    // Se espera (con su catch): en serverless, una promesa suelta se pierde.
    await resend.emails
      .send({
        from: "BG Planner <cesar@tiradacritica.es>",
        to: expelled.email,
        subject: "Hemos cerrado tu cuenta de BG Planner",
        html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner</h2>
        <p>Hemos cerrado tu cuenta de BG Planner porque lo que publicaste incumple nuestros términos de uso, que no toleran el contenido ofensivo ni el acoso.</p>
        <p>Tu cuenta y tus datos personales se han borrado, y este email ya no sirve para entrar.</p>
        <p style="color: #94a3b8; font-size: 14px;">Si crees que es un error, responde a este email o escríbenos desde la página de contacto.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app"}/terms" style="display: inline-block; margin-top: 8px; padding: 10px 18px; background: #f59e0b; color: #0f172a; border-radius: 8px; text-decoration: none; font-weight: bold;">Ver los términos de uso</a>
      </div>
    `,
      })
      .catch((err) => console.error("[expel] fallo al enviar el aviso", err));
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
