import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { emailSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = emailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Rate limit: max 3 codes in last 5 minutes
  const recentCodes = await prisma.otpCode.count({
    where: {
      email,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });

  if (recentCodes >= 3) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.otpCode.create({
    data: {
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  await resend.emails.send({
    from: "GameOn <onboarding@resend.dev>",
    to: email,
    subject: "Tu código de acceso a GameOn",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366f1;">GameOn</h2>
        <p>Tu código de acceso es:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f3f4f6; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #6b7280; font-size: 14px;">Este código expira en 10 minutos.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
