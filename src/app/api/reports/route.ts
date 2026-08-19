import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, getSuperadminEmails } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { escapeHtml } from "@/lib/html";
import { reportSchema } from "@/lib/validations";
import {
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  canAccessReportTarget,
  resolveReportTarget,
  type ReportReason,
  type ReportTarget,
  type ReportTargetType,
} from "@/lib/moderation";

// Denuncia de contenido generado por usuarios (directriz 1.2 de App Store).
//
// A propósito NO se escribe nada en el activity log: una denuncia es privada
// entre quien la pone y los superadmins. Publicarla en el feed del grupo
// expondría al denunciante y sería un canal de represalias.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const targetType = parsed.data.targetType as ReportTargetType;
  const reason = parsed.data.reason as ReportReason;
  const { targetId } = parsed.data;
  const detail = parsed.data.detail?.trim() || null;

  const target = await resolveReportTarget(targetType, targetId);
  if (!target) {
    return NextResponse.json(
      { error: "Ese contenido ya no existe" },
      { status: 404 }
    );
  }

  const allowed = await canAccessReportTarget(session.userId, targetType, target);
  if (!allowed) {
    return NextResponse.json(
      { error: "No tienes acceso a ese contenido" },
      { status: 403 }
    );
  }

  if (target.ownerId === session.userId) {
    return NextResponse.json(
      { error: "No puedes denunciar tu propio contenido" },
      { status: 400 }
    );
  }

  let report;
  try {
    report = await prisma.report.create({
      data: {
        reporterId: session.userId,
        targetType,
        targetId,
        reason,
        detail,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya habías denunciado este contenido. Lo estamos revisando." },
        { status: 409 }
      );
    }
    throw e;
  }

  notifySuperadmins({ report, target, targetType, reason, detail, reporterId: session.userId });

  return NextResponse.json(
    {
      ok: true,
      report: { id: report.id, status: report.status },
    },
    { status: 201 }
  );
}

// Aviso a los superadmins — fire and forget, nunca bloquea la respuesta.
function notifySuperadmins(args: {
  report: { id: string; createdAt: Date };
  target: ReportTarget;
  targetType: ReportTargetType;
  reason: ReportReason;
  detail: string | null;
  reporterId: string;
}) {
  const { report, target, targetType, reason, detail, reporterId } = args;

  (async () => {
    const [recipients, reporter] = await Promise.all([
      getSuperadminEmails(),
      prisma.user.findUnique({
        where: { id: reporterId },
        select: { name: true, displayName: true, email: true },
      }),
    ]);
    if (recipients.length === 0) return;

    const reporterName =
      reporter?.displayName || reporter?.name || reporter?.email || "Alguien";
    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/reports`;

    const rows: [string, string][] = [
      ["Tipo", REPORT_TARGET_LABELS[targetType]],
      ["Qué es", target.kindLabel],
      ["Motivo", REPORT_REASON_LABELS[reason]],
      ["Autor del contenido", target.ownerName],
      ["Denunciado por", reporterName],
    ];

    const rowsHtml = rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding: 6px 12px 6px 0; color: #94a3b8; font-size: 13px; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 14px;">${escapeHtml(value)}</td>
          </tr>`
      )
      .join("");

    const detailHtml = detail
      ? `<blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #f59e0b; background: #1e293b; color: #e2e8f0; font-style: italic; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(detail)}</blockquote>`
      : "";

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin: 0 0 8px;">BG Planner</h2>
        <p style="margin: 0 0 16px; font-size: 18px;"><strong>Nueva denuncia de contenido</strong> 🚩</p>
        <div style="background: #1e293b; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
            ${rowsHtml}
          </table>
        </div>
        <p style="margin: 0 0 6px; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Contenido denunciado</p>
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 16px; color: #e2e8f0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${escapeHtml(target.snippet)}</div>
        ${detailHtml}
        <a href="${adminUrl}" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0 12px;">
          Revisar denuncias
        </a>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 16px;">Denuncia ${escapeHtml(report.id)}<br/>— BG Planner</p>
      </div>
    `;

    await resend.emails.send({
      from: "BG Planner <cesar@tiradacritica.es>",
      to: recipients,
      subject: `🚩 Denuncia de contenido — ${REPORT_REASON_LABELS[reason]}`,
      html,
    });
  })().catch(() => {});
}
