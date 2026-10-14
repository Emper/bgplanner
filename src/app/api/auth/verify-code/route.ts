import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = otpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;
  const now = new Date();

  // Por si pidió el código justo antes de que le expulsaran
  if (await isEmailBanned(email)) {
    return NextResponse.json({ error: BANNED_MESSAGE }, { status: 403 });
  }

  const latest = await prisma.otpCode.findFirst({
    where: { email, used: false, expiresAt: { gte: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!latest) {
    return NextResponse.json(
      { error: "El código ha caducado. Pide uno nuevo." },
      { status: 401 }
    );
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
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un rato antes de volver a probar." },
      { status: 429 }
    );
  }

  if (attempt.attempts > MAX_ATTEMPTS_PER_CODE) {
    return NextResponse.json(
      { error: "Demasiados intentos con este código. Pide uno nuevo." },
      { status: 401 }
    );
  }

  if (!sameCode(attempt.code, code)) {
    const left = MAX_ATTEMPTS_PER_CODE - attempt.attempts;
    return NextResponse.json(
      {
        error:
          left > 0
            ? `Código incorrecto. ${left === 1 ? "Te queda 1 intento" : `Te quedan ${left} intentos`}. Usa el último que te hemos enviado.`
            : "Código incorrecto. Pide uno nuevo.",
      },
      { status: 401 }
    );
  }

  // De un solo uso aunque lleguen dos peticiones a la vez con el código bueno
  const claimed = await prisma.otpCode.updateMany({
    where: { id: latest.id, used: false },
    data: { used: true },
  });
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: "Este código ya se ha usado. Pide uno nuevo." },
      { status: 401 }
    );
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
}
