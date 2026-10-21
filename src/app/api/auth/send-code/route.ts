import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody } from "@/lib/api";
import { emailCode, emailNote, html, sendAppEmail } from "@/lib/email";
import { emailSchema } from "@/lib/validations";
import { reviewLoginCode } from "@/lib/auth";
import { BANNED_MESSAGE, isEmailBanned } from "@/lib/moderation";

export const POST = apiHandler(async (request: NextRequest) => {
  const { email } = await parseBody(request, emailSchema);

  // Quien fue expulsado no puede volver a entrar (ver /terms)
  if (await isEmailBanned(email)) throw new ApiError(403, BANNED_MESSAGE);

  // Rate limit: máximo 3 códigos en los últimos 5 minutos
  const recentCodes = await prisma.otpCode.count({
    where: {
      email,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  if (recentCodes >= 3) {
    throw new ApiError(429, "Demasiados intentos. Espera unos minutos.");
  }

  // La cuenta de revisión de las tiendas tiene un código fijo y no recibe email
  const reviewCode = reviewLoginCode(email);
  const code = reviewCode ?? randomInt(100000, 1000000).toString();

  await prisma.otpCode.create({
    data: {
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
    },
  });

  if (reviewCode) return NextResponse.json({ success: true });

  // El email ES la respuesta: si no sale, hay que decirlo (antes un fallo de
  // Resend se daba por bueno y la persona se quedaba esperando un código).
  const sent = await sendAppEmail({
    to: email,
    subject: "Tu código de acceso a BG Planner",
    maxWidth: 400,
    body: html`<p>Tu código de acceso es:</p>
${emailCode(code)}
${emailNote("Este código expira en 10 minutos.")}`,
  });
  if (!sent) {
    throw new ApiError(502, "No hemos podido enviar el código. Prueba de nuevo en un momento.");
  }

  return NextResponse.json({ success: true });
});
