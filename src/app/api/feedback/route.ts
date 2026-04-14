import { NextRequest, NextResponse } from "next/server";
import { getSession, getSuperadminEmails } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { feedbackSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { subject, message, images } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, displayName: true, email: true },
  });

  const recipients = await getSuperadminEmails();
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No hay destinatarios configurados" }, { status: 500 });
  }

  const attachments = (images || []).map((img, i) => ({
    filename: `imagen-${i + 1}.jpg`,
    content: Buffer.from(img.split(",")[1], "base64"),
  }));

  const userName = user?.displayName || user?.name || "Usuario";
  const userEmail = user?.email || session.email;

  await resend.emails.send({
    from: "BG Planner <cesar@tiradacritica.es>",
    to: recipients,
    subject: `[Feedback] ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner — Feedback</h2>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">De: <strong style="color: #f1f5f9;">${userName}</strong> (${userEmail})</p>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 16px;">Asunto: <strong style="color: #f1f5f9;">${subject}</strong></p>
        <div style="background: #1e293b; padding: 16px; border-radius: 8px; color: #e2e8f0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        ${attachments.length > 0 ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 12px;">${attachments.length} imagen(es) adjunta(s)</p>` : ""}
      </div>
    `,
    ...(attachments.length > 0 ? { attachments } : {}),
  });

  return NextResponse.json({ success: true });
}
