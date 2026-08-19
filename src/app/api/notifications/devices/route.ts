import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deviceTokenSchema, deviceTokenDeleteSchema } from "@/lib/validations";

/**
 * Alta o refresco del token de push de un dispositivo.
 *
 * Es idempotente a propósito: la app lo llama en cada arranque, y FCM puede
 * devolver el mismo token o uno nuevo. Si el token ya existía a nombre de otra
 * persona (móvil compartido, cambio de cuenta) pasa a la sesión actual, que es
 * quien está usando el aparato ahora.
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = deviceTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { token, platform } = parsed.data;

  await prisma.deviceToken.upsert({
    where: { token },
    create: { userId: session.userId, token, platform },
    update: { userId: session.userId, platform },
  });

  return NextResponse.json({ success: true });
}

/** Baja del token: al cerrar sesión o al apagar las push desde el perfil. */
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = deviceTokenDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Filtrado por userId: nadie puede dar de baja el dispositivo de otro.
  await prisma.deviceToken.deleteMany({
    where: { token: parsed.data.token, userId: session.userId },
  });

  return NextResponse.json({ success: true });
}
