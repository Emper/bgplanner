import { NextRequest, NextResponse } from "next/server";
import { getSession, getSuperadminEmails } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { escapeHtml } from "@/lib/html";
import { logActivity } from "@/lib/activity";
import { getStorageClient, uploadPhoto } from "@/lib/supabaseStorage";
import { feedbackSchema } from "@/lib/validations";

// Convierte un data URL (lo que manda el cliente tras redimensionar) en buffer.
function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return { contentType: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

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

  const parsedImages = (images || [])
    .map(parseDataUrl)
    .filter((img): img is { buffer: Buffer; contentType: string } => !!img);

  // Las capturas se guardan en Storage para poder verlas luego desde el panel
  // de admin. Si Storage no está configurado seguimos adelante: el feedback
  // vale más que sus adjuntos.
  let imageUrls: string[] = [];
  if (parsedImages.length > 0 && getStorageClient()) {
    const uploads = await Promise.all(
      parsedImages.map((img) =>
        uploadPhoto(img.buffer, img.contentType, `feedback/${session.userId}`)
          .then((r) => r.url)
          .catch(() => null)
      )
    );
    imageUrls = uploads.filter((u): u is string => !!u);
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: session.userId,
      subject,
      message,
      images: imageUrls,
    },
    select: { id: true },
  });

  logActivity("feedback_sent", session.userId, { feedbackId: feedback.id, subject });

  const userName = user?.displayName || user?.name || "Usuario";
  const userEmail = user?.email || session.email;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bgplanner.app";

  const attachments = parsedImages.map((img, i) => ({
    filename: `imagen-${i + 1}.jpg`,
    content: img.buffer,
  }));

  // Aviso a los superadmins: fire-and-forget, nunca bloquea la respuesta.
  getSuperadminEmails()
    .then((recipients) => {
      if (recipients.length === 0) return;
      return resend.emails.send({
        from: "BG Planner <cesar@tiradacritica.es>",
        to: recipients,
        subject: `[Feedback] ${subject}`,
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner — Feedback</h2>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">De: <strong style="color: #f1f5f9;">${escapeHtml(userName)}</strong> (${escapeHtml(userEmail)})</p>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 16px;">Asunto: <strong style="color: #f1f5f9;">${escapeHtml(subject)}</strong></p>
        <div style="background: #1e293b; padding: 16px; border-radius: 8px; color: #e2e8f0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</div>
        ${attachments.length > 0 ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 12px;">${attachments.length} imagen(es) adjunta(s)</p>` : ""}
        <p style="margin-top: 20px;">
          <a href="${appUrl}/admin/feedback" style="display: inline-block; background: #f59e0b; color: #0f172a; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;">Revisarlo en el panel</a>
        </p>
      </div>
    `,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
    })
    .catch(() => {});

  return NextResponse.json({ success: true, id: feedback.id });
}
