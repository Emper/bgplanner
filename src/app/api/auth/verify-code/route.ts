import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody } from "@/lib/api";
import { signToken, sessionCookieOptions, reviewLoginCode } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { otpSchema } from "@/lib/validations";
import { BANNED_MESSAGE, isEmailBanned } from "@/lib/moderation";

// Contra adivinar el código a ciegas: solo vale el último que se ha pedido,
// cada código aguanta 5 intentos y cada email 10 por hora. El intento se
// apunta ANTES de comparar, así que lanzar muchas peticiones a la vez no
// sirve para colarse por debajo del límite.
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_ATTEMPTS_PER_HOUR = 10;

function sameCode(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const POST = apiHandler(async (request: NextRequest) => {
  const { email, code } = await parseBody(request, otpSchema);
  const now = new Date();

  // Por si pidió el código justo antes de que le expulsaran
  if (await isEmailBanned(email)) {
    throw new ApiError(403, BANNED_MESSAGE);
  }

  const latest = await prisma.otpCode.findFirst({
    where: { email, used: false, expiresAt: { gte: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!latest) {
    throw new ApiError(401, "El código ha caducado. Pide uno nuevo.");
  }

  const attempt = await prisma.otpCode.update({
    where: { id: latest.id },
    data: { attempts: { increment: 1 } },
    select: { code: true, attempts: true },
  });

  const lastHour = await prisma.otpCode.aggregate({
    where: { email, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    _sum: { attempts: true },
  });
  if ((lastHour._sum.attempts ?? 0) > MAX_ATTEMPTS_PER_HOUR) {
    throw new ApiError(429, "Demasiados intentos. Espera un rato antes de volver a probar.");
  }

  if (attempt.attempts > MAX_ATTEMPTS_PER_CODE) {
    throw new ApiError(401, "Demasiados intentos con este código. Pide uno nuevo.");
  }

  if (!sameCode(attempt.code, code)) {
    const left = MAX_ATTEMPTS_PER_CODE - attempt.attempts;
    throw new ApiError(
      401,
      left > 0
        ? `Código incorrecto. ${left === 1 ? "Te queda 1 intento" : `Te quedan ${left} intentos`}. Usa el último que te hemos enviado.`
        : "Código incorrecto. Pide uno nuevo."
    );
  }

  // De un solo uso aunque lleguen dos peticiones a la vez con el código bueno
  const claimed = await prisma.otpCode.updateMany({
    where: { id: latest.id, used: false },
    data: { used: true },
  });
  if (claimed.count === 0) {
    throw new ApiError(401, "Este código ya se ha usado. Pide uno nuevo.");
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  if (reviewLoginCode(email)) logActivity("review_login", user.id);

  const token = await signToken({ userId: user.id, email: user.email });
  const cookie = sessionCookieOptions(token);

  const response = NextResponse.json({
    success: true,
    isNewUser: !user.name,
  });

  response.cookies.set(cookie);
  return response;
});
