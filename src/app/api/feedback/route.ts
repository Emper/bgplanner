import { NextRequest, NextResponse } from "next/server";
import { getSuperadminEmails } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiHandler, parseBody, requireSession } from "@/lib/api";
import { EMAIL_COLORS as C, emailBox, emailButton, emailNote, html, sendAppEmail } from "@/lib/email";
import { inBackground } from "@/lib/background";
import { absoluteUrl } from "@/lib/site";
import { displayName } from "@/lib/users";
import { logActivity } from "@/lib/activity";
import { getStorageClient, uploadPhoto } from "@/lib/supabaseStorage";
import { feedbackSchema } from "@/lib/validations";
import { truncateChars } from "@/lib/text";

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

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { subject, message, images } = await parseBody(request, feedbackSchema);

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

  // Todo lo que se manda se publica al momento en el roadmap para que la gente
  // lo vote. El texto original (con autor y capturas) queda en el Feedback, que
  // solo ve el admin; la propuesta pública es editable desde el panel.
  const feature = await prisma.feature.create({
    data: {
      title: subject,
      description: truncateChars(message, 2000),
      status: "proposed",
      createdById: session.userId,
      feedbacks: {
        create: {
          userId: session.userId,
          subject,
          message,
          images: imageUrls,
          status: "published",
        },
      },
    },
    select: { id: true, title: true, description: true, status: true, createdAt: true },
  });

  logActivity("feedback_sent", session.userId, { featureId: feature.id, subject });

  const attachments = parsedImages.map((img, i) => ({
    filename: `imagen-${i + 1}.jpg`,
    content: img.buffer,
  }));

  // Aviso a los superadmins, después de responder, con las capturas adjuntas.
  inBackground(async () => {
    const [recipients, user] = await Promise.all([
      getSuperadminEmails(),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, displayName: true, email: true },
      }),
    ]);
    if (recipients.length === 0) return;

    const body = html`<p style="color: ${C.muted}; font-size: 13px; margin-bottom: 4px;">De: <strong style="color: ${C.text};">${displayName(user, "Usuario")}</strong> (${user?.email || session.email})</p>
<p style="color: ${C.muted}; font-size: 13px; margin-bottom: 16px;">Asunto: <strong style="color: ${C.text};">${subject}</strong></p>
${emailBox(html`<div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</div>`)}
${attachments.length > 0 ? emailNote(`${attachments.length} imagen(es) adjunta(s)`) : false}
${emailButton(absoluteUrl("/admin/roadmap"), "Revisarlo en el panel")}`;

    await sendAppEmail({
      to: recipients,
      subject: `[Feedback] ${subject}`,
      body,
      maxWidth: 600,
      attachments,
    });
  });

  return NextResponse.json({
    success: true,
    feature: { ...feature, votes: 0, hasVoted: false },
  });
});
