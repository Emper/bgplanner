import { NextRequest, NextResponse } from "next/server";
import { getSuperadminEmails } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { contactSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, email, subject, message, honeypot } = parsed.data;

  // Spam trap
  if (honeypot) {
    return NextResponse.json({ success: true });
  }

  const recipients = await getSuperadminEmails();
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No hay destinatarios configurados" }, { status: 500 });
  }

  await resend.emails.send({
    from: "BG Planner <cesar@tiradacritica.es>",
    to: recipients,
    replyTo: email,
    subject: `[Contacto] ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner — Contacto</h2>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">De: <strong style="color: #f1f5f9;">${name.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong> (${email})</p>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 16px;">Asunto: <strong style="color: #f1f5f9;">${subject.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong></p>
        <div style="background: #1e293b; padding: 16px; border-radius: 8px; color: #e2e8f0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
