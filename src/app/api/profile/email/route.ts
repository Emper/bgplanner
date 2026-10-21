import { createHash, randomInt, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireSession } from "@/lib/api";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { EMAIL_COLORS as C, emailCode, emailNote, html, sendAppEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity";
import { isEmailBanned } from "@/lib/moderation";
import {
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
} from "@/lib/validations";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min, igual que el OTP de login
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;

// El código nunca se guarda en claro: solo su hash, salado con el id del
// usuario para que dos solicitudes con el mismo código no compartan hash.
function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function codeMatches(userId: string, code: string, codeHash: string): boolean {
  const a = Buffer.from(hashCode(userId, code), "hex");
  const b = Buffer.from(codeHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Los envíos se esperan antes de responder: el del código es la respuesta
// misma, y los avisos de seguridad (al email antiguo) no deben perderse.

// GET — email actual + solicitud de cambio pendiente (si la hay)
export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  const [user, pending] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    }),
    prisma.emailChangeRequest.findFirst({
      where: {
        userId: session.userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { newEmail: true, expiresAt: true },
    }),
  ]);

  if (!user) throw new ApiError(404, "Usuario no encontrado");

  return NextResponse.json({
    email: user.email,
    pending: pending
      ? {
          newEmail: pending.newEmail,
          expiresAt: pending.expiresAt.toISOString(),
        }
      : null,
  });
});

// POST — pedir el cambio: manda un código de 6 dígitos al email NUEVO
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { email: newEmail } = await parseBody(request, emailChangeRequestSchema);

  // Comparación sin distinguir mayúsculas: en BD puede haber emails antiguos
  // con mayúsculas y no queremos dos cuentas que solo se diferencien en eso.
  const [user, taken, banned, recentRequests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true },
    }),
    prisma.user.findFirst({
      where: {
        email: { equals: newEmail, mode: "insensitive" },
        id: { not: session.userId },
      },
      select: { id: true },
    }),
    isEmailBanned(newEmail),
    prisma.emailChangeRequest.count({
      where: {
        userId: session.userId,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    }),
  ]);
  if (!user) throw new ApiError(404, "Usuario no encontrado");
  if (user.email.toLowerCase() === newEmail) {
    throw new ApiError(400, "Ese ya es tu email actual");
  }
  // Un email expulsado responde igual que uno ocupado: no se dice por qué.
  if (taken || banned) throw new ApiError(409, "Ya hay una cuenta con ese email");
  if (recentRequests >= MAX_REQUESTS_PER_WINDOW) {
    throw new ApiError(429, "Demasiados intentos. Espera unos minutos.");
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // Cualquier solicitud anterior deja de valer en cuanto se pide otra.
  await prisma.emailChangeRequest.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const changeRequest = await prisma.emailChangeRequest.create({
    data: {
      userId: user.id,
      newEmail,
      codeHash: hashCode(user.id, code),
      expiresAt,
    },
    select: { id: true },
  });

  const [codeSent] = await Promise.all([
    sendAppEmail({
      to: newEmail,
      subject: "Confirma tu nuevo email en BG Planner",
      body: html`<p>Has pedido usar esta dirección como email de tu cuenta de BG Planner. Tu código de confirmación es:</p>
${emailCode(code)}
${emailNote("Este código expira en 10 minutos. Hasta que lo introduzcas, tu cuenta sigue con el email de siempre.")}
${emailNote("Si no has sido tú, ignora este email.")}`,
    }),
    // Aviso al email antiguo: si alguien intenta robar la cuenta, el dueño se entera.
    sendAppEmail({
      to: user.email,
      subject: "Se ha pedido cambiar el email de tu cuenta",
      body: html`<p>Se ha solicitado cambiar el email de tu cuenta de BG Planner a <strong style="color: ${C.accent};">${newEmail}</strong>.</p>
<p>El cambio no se aplicará hasta que se confirme con el código enviado a esa dirección.</p>
${emailNote("Si no has sido tú, entra en tu perfil y cancela la solicitud. Tu cuenta sigue asociada a este email.")}`,
    }),
  ]);

  // Sin código no hay cambio que confirmar: la solicitud no queda pendiente.
  if (!codeSent) {
    await prisma.emailChangeRequest.update({
      where: { id: changeRequest.id },
      data: { usedAt: new Date() },
    });
    throw new ApiError(502, "No hemos podido enviar el código. Prueba de nuevo en un momento.");
  }

  return NextResponse.json({
    success: true,
    newEmail,
    expiresAt: expiresAt.toISOString(),
  });
});

// PUT — confirmar el cambio con el código recibido en el email nuevo
export const PUT = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);
  const { code } = await parseBody(request, emailChangeConfirmSchema);

  const pending = await prisma.emailChangeRequest.findFirst({
    where: { userId: session.userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!pending || pending.expiresAt <= new Date()) {
    throw new ApiError(400, "No hay ningún cambio de email pendiente. Pide un código nuevo.");
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(429, "Demasiados intentos fallidos. Pide un código nuevo.");
  }

  if (!codeMatches(session.userId, code, pending.codeHash)) {
    const updated = await prisma.emailChangeRequest.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const left = Math.max(MAX_ATTEMPTS - updated.attempts, 0);
    throw new ApiError(
      401,
      left
        ? `Código incorrecto. Te ${left === 1 ? "queda 1 intento" : `quedan ${left} intentos`}.`
        : "Código incorrecto. Pide un código nuevo."
    );
  }

  // Alguien puede haber registrado ese email entre la solicitud y la confirmación.
  const [user, taken] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true },
    }),
    prisma.user.findFirst({
      where: {
        email: { equals: pending.newEmail, mode: "insensitive" },
        id: { not: session.userId },
      },
      select: { id: true },
    }),
  ]);
  if (!user) throw new ApiError(404, "Usuario no encontrado");
  if (taken) {
    await prisma.emailChangeRequest.update({
      where: { id: pending.id },
      data: { usedAt: new Date() },
    });
    throw new ApiError(409, "Ya hay una cuenta con ese email");
  }

  const previousEmail = user.email;

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { email: pending.newEmail },
      }),
      prisma.emailChangeRequest.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002") {
      throw new ApiError(409, "Ya hay una cuenta con ese email");
    }
    throw err;
  }

  logActivity("email_changed", user.id, {});

  // El cambio ya está hecho: si un aviso no sale, queda en los logs y ya.
  await Promise.all([
    sendAppEmail({
      to: pending.newEmail,
      subject: "Tu email de BG Planner ya está actualizado",
      body: html`<p>Listo: tu cuenta de BG Planner ya usa esta dirección. A partir de ahora recibirás aquí los códigos de acceso y los avisos de tus grupos.</p>
${emailNote(`El email anterior (${previousEmail}) ya no sirve para entrar.`)}`,
    }),
    sendAppEmail({
      to: previousEmail,
      subject: "El email de tu cuenta de BG Planner ha cambiado",
      body: html`<p>El email de tu cuenta de BG Planner es ahora <strong style="color: ${C.accent};">${pending.newEmail}</strong>. Esta dirección ya no sirve para entrar.</p>
${emailNote("Si no has sido tú, escríbenos respondiendo a este email lo antes posible.")}`,
    }),
  ]);

  // El email viaja dentro del JWT de sesión: hay que reemitir la cookie para
  // que la sesión abierta no siga arrastrando el email antiguo.
  const token = await signToken({ userId: user.id, email: pending.newEmail });
  const response = NextResponse.json({ success: true, email: pending.newEmail });
  response.cookies.set(sessionCookieOptions(token));
  return response;
});

// DELETE — cancelar la solicitud pendiente
export const DELETE = apiHandler(async (request: NextRequest) => {
  const session = await requireSession(request);

  await prisma.emailChangeRequest.updateMany({
    where: { userId: session.userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ success: true });
});
