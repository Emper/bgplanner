import { NextRequest, NextResponse } from "next/server";
import { ApiError, apiHandler, parseBody } from "@/lib/api";
import { getSuperadminEmails } from "@/lib/auth";
import { CONTACT_EMAIL } from "@/lib/contact";
import { EMAIL_COLORS as C, emailBox, html, sendAppEmail } from "@/lib/email";
import { contactSchema } from "@/lib/validations";

// El mensaje no se guarda en ningún sitio: solo existe en el email al buzón.
// Por eso se espera al envío y, si falla, se dice (la página de contacto
// enseña el error y la persona puede reintentar o escribirnos directamente).
const SEND_FAILED = `No hemos podido enviar tu mensaje. Prueba de nuevo en un momento o escríbenos a ${CONTACT_EMAIL}.`;

export const POST = apiHandler(async (request: NextRequest) => {
  const { name, email, subject, message, honeypot } = await parseBody(request, contactSchema);

  // Trampa para bots: "enviado" sin enviar nada, para que no aprendan.
  if (honeypot) return NextResponse.json({ success: true });

  const recipients = await getSuperadminEmails();
  if (recipients.length === 0) {
    console.error("[contact] No hay superadmins a quien mandar el mensaje");
    throw new ApiError(500, SEND_FAILED);
  }

  const sent = await sendAppEmail({
    to: recipients,
    replyTo: email,
    subject: `[Contacto] ${subject}`,
    maxWidth: 600,
    body: html`<p style="color: ${C.muted}; font-size: 13px; margin-bottom: 4px;">De: <strong style="color: ${C.text};">${name}</strong> (${email})</p>
<p style="color: ${C.muted}; font-size: 13px; margin-bottom: 16px;">Asunto: <strong style="color: ${C.text};">${subject}</strong></p>
${emailBox(html`<div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</div>`)}`,
  });
  if (!sent) throw new ApiError(502, SEND_FAILED);

  return NextResponse.json({ success: true });
});
