import { createHash, randomInt, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, signToken, sessionCookieOptions } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { escapeHtml } from "@/lib/html";
import { logActivity } from "@/lib/activity";
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

function emailLayout(inner: string): string {
  return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 16px;">BG Planner</h2>
        ${inner}
      </div>
    `;
}

// GET — email actual + solicitud de cambio pendiente (si la hay)
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    pending: pending
      ? {
          newEmail: pending.newEmail,
          expiresAt: pending.expiresAt.toISOString(),
        }
      : null,
  });
}

// POST — pedir el cambio: manda un código de 6 dígitos al email NUEVO
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = emailChangeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const newEmail = parsed.data.email;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, displayName: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (user.email.toLowerCase() === newEmail) {
    return NextResponse.json(
      { error: "Ese ya es tu email actual" },
      { status: 400 }
    );
  }

  // Comparación sin distinguir mayúsculas: en BD puede haber emails antiguos
  // con mayúsculas y no queremos dos cuentas que solo se diferencien en eso.
  const taken = await prisma.user.findFirst({
    where: {
      email: { equals: newEmail, mode: "insensitive" },
      id: { not: user.id },
    },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: "Ya hay una cuenta con ese email" },
      { status: 409 }
    );
  }

  const recentRequests = await prisma.emailChangeRequest.count({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
  });
  if (recentRequests >= MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // Cualquier solicitud anterior deja de valer en cuanto se pide otra.
  await prisma.emailChangeRequest.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailChangeRequest.create({
    data: {
      userId: user.id,
      newEmail,
      codeHash: hashCode(user.id, code),
      expiresAt,
    },
  });

  resend.emails
    .send({
      from: "BG Planner <cesar@tiradacritica.es>",
      to: newEmail,
      subject: "Confirma tu nuevo email en BG Planner",
      html: emailLayout(`
        <p>Has pedido usar esta dirección como email de tu cuenta de BG Planner. Tu código de confirmación es:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #1e293b; border-radius: 8px; margin: 20px 0; color: #f59e0b;">
          ${code}
        </div>
        <p style="color: #94a3b8; font-size: 14px;">Este código expira en 10 minutos. Hasta que lo introduzcas, tu cuenta sigue con el email de siempre.</p>
        <p style="color: #94a3b8; font-size: 14px;">Si no has sido tú, ignora este email.</p>
      `),
    })
    .catch(() => {});

  // Aviso al email antiguo: si alguien intenta robar la cuenta, el dueño se entera.
  resend.emails
    .send({
      from: "BG Planner <cesar@tiradacritica.es>",
      to: user.email,
      subject: "Se ha pedido cambiar el email de tu cuenta",
      html: emailLayout(`
        <p>Se ha solicitado cambiar el email de tu cuenta de BG Planner a <strong style="color: #f59e0b;">${escapeHtml(newEmail)}</strong>.</p>
        <p>El cambio no se aplicará hasta que se confirme con el código enviado a esa dirección.</p>
        <p style="color: #94a3b8; font-size: 14px;">Si no has sido tú, entra en tu perfil y cancela la solicitud. Tu cuenta sigue asociada a este email.</p>
      `),
    })
    .catch(() => {});

  return NextResponse.json({
    success: true,
    newEmail,
    expiresAt: expiresAt.toISOString(),
  });
}

// PUT — confirmar el cambio con el código recibido en el email nuevo
export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = emailChangeConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const pending = await prisma.emailChangeRequest.findFirst({
    where: { userId: session.userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!pending || pending.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: "No hay ningún cambio de email pendiente. Pide un código nuevo." },
      { status: 400 }
    );
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Pide un código nuevo." },
      { status: 429 }
    );
  }

  if (!codeMatches(session.userId, parsed.data.code, pending.codeHash)) {
    const updated = await prisma.emailChangeRequest.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const left = Math.max(MAX_ATTEMPTS - updated.attempts, 0);
    return NextResponse.json(
      {
        error: left
          ? `Código incorrecto. Te ${left === 1 ? "queda 1 intento" : `quedan ${left} intentos`}.`
          : "Código incorrecto. Pide un código nuevo.",
      },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Alguien puede haber registrado ese email entre la solicitud y la confirmación.
  const taken = await prisma.user.findFirst({
    where: {
      email: { equals: pending.newEmail, mode: "insensitive" },
      id: { not: user.id },
    },
    select: { id: true },
  });
  if (taken) {
    await prisma.emailChangeRequest.update({
      where: { id: pending.id },
      data: { usedAt: new Date() },
    });
    return NextResponse.json(
      { error: "Ya hay una cuenta con ese email" },
      { status: 409 }
    );
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
      return NextResponse.json(
        { error: "Ya hay una cuenta con ese email" },
        { status: 409 }
      );
    }
    throw err;
  }

  logActivity("email_changed", user.id, {});

  resend.emails
    .send({
      from: "BG Planner <cesar@tiradacritica.es>",
      to: pending.newEmail,
      subject: "Tu email de BG Planner ya está actualizado",
      html: emailLayout(`
        <p>Listo: tu cuenta de BG Planner ya usa esta dirección. A partir de ahora recibirás aquí los códigos de acceso y los avisos de tus grupos.</p>
        <p style="color: #94a3b8; font-size: 14px;">El email anterior (${escapeHtml(previousEmail)}) ya no sirve para entrar.</p>
      `),
    })
    .catch(() => {});

  resend.emails
    .send({
      from: "BG Planner <cesar@tiradacritica.es>",
      to: previousEmail,
      subject: "El email de tu cuenta de BG Planner ha cambiado",
      html: emailLayout(`
        <p>El email de tu cuenta de BG Planner es ahora <strong style="color: #f59e0b;">${escapeHtml(pending.newEmail)}</strong>. Esta dirección ya no sirve para entrar.</p>
        <p style="color: #94a3b8; font-size: 14px;">Si no has sido tú, escríbenos respondiendo a este email lo antes posible.</p>
      `),
    })
    .catch(() => {});

  // El email viaja dentro del JWT de sesión: hay que reemitir la cookie para
  // que la sesión abierta no siga arrastrando el email antiguo.
  const token = await signToken({ userId: user.id, email: pending.newEmail });
  const response = NextResponse.json({ success: true, email: pending.newEmail });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}

// DELETE — cancelar la solicitud pendiente
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await prisma.emailChangeRequest.updateMany({
    where: { userId: session.userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
