import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isSuperadmin } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { escapeHtml } from "@/lib/html";
import { logActivity } from "@/lib/activity";
import { feedbackReviewSchema } from "@/lib/validations";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

// Email al autor del feedback contándole qué hemos decidido. Fire-and-forget:
// que falle el aviso nunca debe tumbar el triaje.
function notifyAuthor(opts: {
  to: string;
  name: string;
  subject: string;
  accepted: boolean;
  featureTitle?: string;
  adminNote?: string;
}) {
  const { to, name, subject, accepted, featureTitle, adminNote } = opts;
  const heading = accepted ? "¡Tu propuesta entra en el roadmap!" : "Hemos revisado tu propuesta";
  const intro = accepted
    ? `Hemos leído lo que nos mandaste sobre <strong style="color:#f1f5f9;">${escapeHtml(subject)}</strong> y nos ha gustado: ya está publicada en el roadmap${featureTitle ? ` como <strong style="color:#f1f5f9;">${escapeHtml(featureTitle)}</strong>` : ""}, para que el resto de jugadores pueda votarla.`
    : `Hemos leído lo que nos mandaste sobre <strong style="color:#f1f5f9;">${escapeHtml(subject)}</strong>. De momento no la vamos a llevar adelante, pero gracias por tomarte el tiempo de escribirnos.`;

  resend.emails
    .send({
      from: "BG Planner <cesar@tiradacritica.es>",
      to: [to],
      subject: accepted ? `Tu propuesta está en el roadmap: ${subject}` : `Sobre tu propuesta: ${subject}`,
      html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">${heading}</h2>
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6;">Hola ${escapeHtml(name)},</p>
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6;">${intro}</p>
        ${
          adminNote
            ? `<div style="background: #1e293b; padding: 16px; border-radius: 8px; border: 1px solid #334155; color: #e2e8f0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin: 16px 0;">${escapeHtml(adminNote)}</div>`
            : ""
        }
        <p style="margin-top: 20px;">
          <a href="${APP_URL}/roadmap" style="display: inline-block; background: #f59e0b; color: #0f172a; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;">Ver el roadmap</a>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">BG Planner</p>
      </div>
    `,
    })
    .catch(() => {});
}

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

  const { id } = await params;
  const body = await request.json();
  const parsed = feedbackReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action, title, description, status, featureId, adminNote, notify } = parsed.data;

  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: { user: { select: { name: true, displayName: true, email: true } } },
  });
  if (!feedback) {
    return NextResponse.json({ error: "Feedback no encontrado" }, { status: 404 });
  }

  if (action === "reopen") {
    const updated = await prisma.feedback.update({
      where: { id },
      data: { status: "pending", reviewedAt: null, reviewedById: null, adminNote: null },
      select: { id: true, status: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "reject") {
    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        status: "rejected",
        adminNote: adminNote || null,
        reviewedAt: new Date(),
        reviewedById: session.userId,
      },
      select: { id: true, status: true, adminNote: true },
    });

    logActivity("feedback_rejected", session.userId, { feedbackId: id, subject: feedback.subject });

    if (notify) {
      notifyAuthor({
        to: feedback.user.email,
        name: feedback.user.displayName || feedback.user.name || "",
        subject: feedback.subject,
        accepted: false,
        adminNote: adminNote || undefined,
      });
    }

    return NextResponse.json(updated);
  }

  // action === "accept": se publica como propuesta del roadmap. O se vincula a
  // una propuesta existente (feedback duplicado) o se crea una nueva con el
  // texto que haya redactado el admin.
  let feature;
  if (featureId) {
    feature = await prisma.feature.findUnique({
      where: { id: featureId },
      select: { id: true, title: true },
    });
    if (!feature) {
      return NextResponse.json({ error: "La propuesta indicada no existe" }, { status: 404 });
    }
  } else {
    feature = await prisma.feature.create({
      data: {
        title: title!,
        description: description!,
        status: status || "proposed",
        createdById: session.userId,
      },
      select: { id: true, title: true },
    });
  }

  const updated = await prisma.feedback.update({
    where: { id },
    data: {
      status: "accepted",
      featureId: feature.id,
      adminNote: adminNote || null,
      reviewedAt: new Date(),
      reviewedById: session.userId,
    },
    select: { id: true, status: true, featureId: true },
  });

  logActivity("feedback_accepted", session.userId, {
    feedbackId: id,
    subject: feedback.subject,
    featureId: feature.id,
  });

  if (notify) {
    notifyAuthor({
      to: feedback.user.email,
      name: feedback.user.displayName || feedback.user.name || "",
      subject: feedback.subject,
      accepted: true,
      featureTitle: feature.title,
      adminNote: adminNote || undefined,
    });
  }

  return NextResponse.json({ ...updated, feature });
}

// Borra un feedback de la bandeja. La propuesta publicada, si la hay, se queda.
export async function DELETE(
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

  const { id } = await params;
  await prisma.feedback.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
